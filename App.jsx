import React, { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { createClient } from '@supabase/supabase-js'
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Mug Studio is code-split: the studio component (≈25KB) and its dynamic
// `import('three')` (≈190KB gz) ship in their own chunks and load ONLY when a
// visitor opens #mug-studio. The main app bundle stays free of three.js.
const MugStudio = lazy(() => import('./MugStudio.jsx'));
const supabase = createClient('https://ubvgrxlxtelulwjtfudd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmdyeGx4dGVsdWx3anRmdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODIyODMsImV4cCI6MjA5NDM1ODI4M30.79zQ0LMAzzocGSMD3ruNl2m_jan6siQJ_A1Ex7lOxyE')

// ── A11y: dialog focus management (WCAG 2.4.3 / 2.1.2) ──────────────────────
// When `active` becomes true: remember the currently-focused element, move focus
// into the dialog (first focusable, or the container), and keep Tab/Shift+Tab
// cycling inside it. On deactivate/unmount: restore focus to the trigger.
// Esc-to-close stays each dialog's own concern (some have layered Esc logic).
// Returns a ref to attach to the dialog container.
function useDialogFocus(active) {
  const ref = useRef(null);
  const restoreRef = useRef(null);
  useEffect(() => {
    if (!active || typeof document === `undefined`) return;
    const node = ref.current;
    if (!node) return;
    restoreRef.current = document.activeElement;
    const SEL = `a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])`;
    const focusables = () => Array.prototype.slice.call(node.querySelectorAll(SEL)).filter(el => el.offsetParent !== null || el === document.activeElement);
    const first = focusables()[0];
    if (first) first.focus();
    else { node.setAttribute(`tabindex`, `-1`); node.focus(); }
    const onKey = (e) => {
      if (e.key !== `Tab`) return;
      const f = focusables();
      if (f.length === 0) { e.preventDefault(); node.focus(); return; }
      const a = f[0], z = f[f.length - 1];
      if (!node.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
      else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    node.addEventListener(`keydown`, onKey);
    return () => {
      node.removeEventListener(`keydown`, onKey);
      const r = restoreRef.current;
      if (r && typeof r.focus === `function`) { try { r.focus(); } catch (_) {} }
    };
  }, [active]);
  return ref;
}

// ============================================================================
// FAVORITES — client-only "heart" store (localStorage, no auth/DB/Supabase).
// One key holds an array of design slugs. All storage access is try/catch-guarded
// (private-mode safe). toggleFavorite dispatches a window event so every
// useFavorites() consumer (cards, modal, breed page, nav badge) updates instantly
// and stays in sync; the native `storage` event syncs across tabs.
// ============================================================================
const FAVORITES_KEY = `sf_favorites`;
const FAVORITES_EVENT = `sf-favorites-changed`;
function readFavorites() {
  try {
    const raw = typeof localStorage !== `undefined` ? localStorage.getItem(FAVORITES_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => typeof s === `string`) : [];
  } catch (_) { return []; }
}
function writeFavorites(arr) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); } catch (_) {}
}
function getFavorites() { return readFavorites(); }
function toggleFavorite(slug) {
  if (!slug) return readFavorites();
  const cur = readFavorites();
  const next = cur.includes(slug) ? cur.filter(s => s !== slug) : cur.concat(slug);
  writeFavorites(next);
  try { if (typeof window !== `undefined`) window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: next })); } catch (_) {}
  return next;
}
// React hook: an in-memory mirror kept in sync via the window event (same tab)
// and the native storage event (other tabs). Re-renders every consumer on change.
function useFavorites() {
  const [favs, setFavs] = useState(readFavorites);
  useEffect(() => {
    const sync = () => setFavs(readFavorites());
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener(`storage`, sync);
    return () => { window.removeEventListener(FAVORITES_EVENT, sync); window.removeEventListener(`storage`, sync); };
  }, []);
  return {
    favorites: favs,
    isFavorite: (slug) => favs.includes(slug),
    toggle: (slug) => setFavs(toggleFavorite(slug)),
  };
}

// Reusable heart button — self-contained trilingual aria-label that reflects
// state, aria-pressed, keyboard-operable (real <button>), and stops propagation
// so it never triggers a parent card's click/keydown. Filled = favorited,
// outline = not. Lives inside #root, so high-contrast (filter) applies to it too.
function FavHeart({ slug, name, lang, size = 38 }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(slug);
  const nm = name || ``;
  const label = fav
    ? (lang === `he` ? `הסר את ${nm} מהמועדפים` : lang === `ru` ? `Удалить ${nm} из избранного` : `Remove ${nm} from favorites`)
    : (lang === `he` ? `הוסף את ${nm} למועדפים` : lang === `ru` ? `Добавить ${nm} в избранное` : `Add ${nm} to favorites`);
  const icon = Math.round(size * 0.52);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={fav}
      title={label}
      onClick={(e) => { e.stopPropagation(); toggle(slug); }}
      onKeyDown={(e) => { if (e.key === `Enter` || e.key === ` `) e.stopPropagation(); }}
      style={{
        width: size, height: size, borderRadius: `50%`, padding: 0,
        border: `1px solid ${fav ? COLORS.accent : `rgba(255,255,255,0.35)`}`,
        background: `rgba(0,0,0,0.55)`, backdropFilter: `blur(10px)`, WebkitBackdropFilter: `blur(10px)`,
        color: fav ? COLORS.accent : `#fff`, cursor: `pointer`,
        display: `flex`, alignItems: `center`, justifyContent: `center`,
        transition: `color 0.2s, border-color 0.2s, transform 0.15s`, touchAction: `manipulation`,
      }}
      onMouseOver={e => { e.currentTarget.style.transform = `scale(1.12)`; }}
      onMouseOut={e => { e.currentTarget.style.transform = `scale(1)`; }}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill={fav ? `currentColor` : `none`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  );
}

// ============================================================================
// WHATSAPP — floating chat button (client-only). The owner sets the number in
// ONE place below; while it's the placeholder the button is HIDDEN so a broken
// link never ships. Portaled to <body> (like the a11y FAB) so the high-contrast
// filter on #root can never become its containing block.
// ============================================================================
// ⬇️ OWNER: replace with the shop's WhatsApp number — international format, no
//    "+" and no spaces, e.g. 972501234567. Leave as-is to keep the button hidden.
const WHATSAPP_NUMBER = `972504847874`;
function WhatsAppFab({ lang }) {
  // Only render once a real number is set (6–15 digits) — never a broken link.
  if (!/^\d{6,15}$/.test(WHATSAPP_NUMBER || ``)) return null;
  if (typeof document === `undefined`) return null;
  const greeting = lang === `he` ? `היי! יש לי שאלה על BLOOM 🐾` : lang === `ru` ? `Здравствуйте! У меня вопрос о BLOOM 🐾` : `Hi! I have a question about BLOOM 🐾`;
  const label = lang === `he` ? `שוחחו איתנו בוואטסאפ` : lang === `ru` ? `Напишите нам в WhatsApp` : `Chat with us on WhatsApp`;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(greeting)}`;
  return createPortal(
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="wa-fab"
      style={{ position: `fixed`, bottom: 24, insetInlineEnd: 24, zIndex: 940, width: 52, height: 52, borderRadius: `50%`, background: `#25D366`, display: `flex`, alignItems: `center`, justifyContent: `center`, boxShadow: `0 4px 20px rgba(37,211,102,0.5)`, textDecoration: `none` }}
      onMouseOver={e => { e.currentTarget.style.transform = `scale(1.1)`; e.currentTarget.style.boxShadow = `0 6px 30px rgba(37,211,102,0.7)`; }}
      onMouseOut={e => { e.currentTarget.style.transform = `scale(1)`; e.currentTarget.style.boxShadow = `0 4px 20px rgba(37,211,102,0.5)`; }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.582 0 11.94-5.335 11.944-11.893a11.821 11.821 0 0 0-3.487-8.46z"/></svg>
    </a>,
    document.body
  );
}

// Compact trust strip — "Ships anywhere in Israel" always; "Secure payment"
// ONLY when payments are live (PAYMENTS_ENABLED), so it never claims secure
// checkout while payments are off. Subtle, on-brand (faint orange tint).
function TrustStrip({ lang }) {
  const isRTL = lang === `he`;
  const ships = lang === `he` ? `משלוח לכל הארץ` : lang === `ru` ? `Доставка по всему Израилю` : `Ships anywhere in Israel`;
  const secure = lang === `he` ? `תשלום מאובטח` : lang === `ru` ? `Безопасная оплата` : `Secure payment`;
  const item = (icon, text) => (
    <span style={{ display: `inline-flex`, alignItems: `center`, gap: 6, color: COLORS.gray, fontSize: 12, fontFamily: `'Varela Round',sans-serif` }}>
      <span aria-hidden="true" style={{ fontSize: 14 }}>{icon}</span><span>{text}</span>
    </span>
  );
  return (
    <div style={{ display: `flex`, flexWrap: `wrap`, gap: `8px 18px`, justifyContent: `center`, alignItems: `center`, padding: `10px 14px`, background: `rgba(255,107,53,0.06)`, border: `1px solid rgba(255,107,53,0.18)`, borderRadius: 8, direction: isRTL ? `rtl` : `ltr` }}>
      {item(`🚚`, ships)}
      {PAYMENTS_ENABLED && item(`🔒`, secure)}
    </div>
  );
}

// ============================================================================
// FloatingProductCard — כרטיס מוצר מרחף עם אפקט הטיה + זוהר הולוגרפי חם
// ----------------------------------------------------------------------------
// • קובץ אחד, ללא תלות חיצונית. ה-CSS מוטמע בתוך הרכיב (מוזרק פעם אחת ל-<head>).
// • JSX רגיל (לא TypeScript). תואם Vite 4.5 / esbuild 0.18.
// • שימוש אך ורק ב-template literals (גרשיים הפוכים) — אפס חיבור מחרוזות עם +.
// • משתמש ב-React.* כדי שלא יתנגש עם ה-import של React הקיים ב-App.jsx שלך.
//
// אופן שימוש (דוגמה):
//   <FloatingProductCard
//     imageUrl="https://.../tshirt.jpg"
//     name="חולצת אוברסייז קלאסית"
//     description="כותנה 100% • גזרה רחבה ונוחה לכל יום"
//     price="₪149"
//     status="במלאי • משלוח תוך 48 שעות"
//     buttonText="הוסף לעגלה"
//     onAddToCart={() => console.log('added')}
//   />
// ============================================================================

const FLOATING_CARD_STYLE_ID = `floating-product-card-styles`;

const FLOATING_CARD_CSS = `
.fpc-wrapper {
  --pointer-x: 50%;
  --pointer-y: 50%;
  --pointer-from-center: 0;
  --pointer-from-top: 0.5;
  --pointer-from-left: 0.5;
  --card-opacity: 0;
  --rotate-x: 0deg;
  --rotate-y: 0deg;
  --background-x: 50%;
  --background-y: 50%;
  --grain: none;
  --icon: none;
  --behind-gradient: none;
  --inner-gradient: none;
  --sunpillar-1: hsl(8, 100%, 62%);
  --sunpillar-2: hsl(20, 100%, 60%);
  --sunpillar-3: hsl(32, 100%, 58%);
  --sunpillar-4: hsl(42, 100%, 60%);
  --sunpillar-5: hsl(50, 100%, 66%);
  --sunpillar-6: hsl(38, 100%, 74%);
  --sunpillar-clr-1: var(--sunpillar-1);
  --sunpillar-clr-2: var(--sunpillar-2);
  --sunpillar-clr-3: var(--sunpillar-3);
  --sunpillar-clr-4: var(--sunpillar-4);
  --sunpillar-clr-5: var(--sunpillar-5);
  --sunpillar-clr-6: var(--sunpillar-6);
  --card-radius: 30px;
  --brand-orange: #f97316;
  --brand-orange-hover: #fb8a3c;
  perspective: 500px;
  transform: translate3d(0, 0, 0.1px);
  position: relative;
  touch-action: none;
  direction: rtl;
}
.fpc-wrapper::before {
  content: '';
  position: absolute;
  inset: -10px;
  background: inherit;
  background-position: inherit;
  border-radius: inherit;
  transition: all 0.5s ease;
  filter: contrast(2) saturate(2) blur(36px);
  transform: scale(0.8) translate3d(0, 0, 0.1px);
  background-size: 100% 100%;
  background-image: var(--behind-gradient);
}
.fpc-wrapper:hover,
.fpc-wrapper.active {
  --card-opacity: 1;
}
.fpc-wrapper:hover::before,
.fpc-wrapper.active::before {
  filter: contrast(1) saturate(2) blur(40px) opacity(1);
  transform: scale(0.9) translate3d(0, 0, 0.1px);
}
.fpc-card {
  height: 80svh;
  max-height: 540px;
  display: grid;
  aspect-ratio: 0.718;
  border-radius: var(--card-radius);
  position: relative;
  background-blend-mode: color-dodge, normal, normal, normal;
  animation: fpc-glow-bg 12s linear infinite;
  box-shadow:
    rgba(0, 0, 0, 0.8) calc((var(--pointer-from-left) * 10px) - 3px) calc((var(--pointer-from-top) * 20px) - 6px) 20px -5px,
    0 0 40px -8px rgba(249, 115, 22, 0.55);
  transition: transform 1s ease;
  transform: translate3d(0, 0, 0.1px) rotateX(0deg) rotateY(0deg);
  background-size: 100% 100%;
  background-position: 0 0, 0 0, 50% 50%, 0 0;
  background-image:
    radial-gradient(farthest-side circle at var(--pointer-x) var(--pointer-y),
      hsla(24, 100%, 75%, var(--card-opacity)) 4%,
      hsla(24, 80%, 55%, calc(var(--card-opacity) * 0.75)) 10%,
      hsla(20, 60%, 40%, calc(var(--card-opacity) * 0.5)) 50%,
      hsla(20, 0%, 20%, 0) 100%),
    radial-gradient(35% 52% at 55% 20%, #fb923cc4 0%, #f9731600 100%),
    radial-gradient(100% 100% at 50% 50%, #f97316ff 1%, #f9731600 76%),
    conic-gradient(from 124deg at 50% 50%, #f97316ff 0%, #fb923cff 40%, #fb923cff 60%, #f97316ff 100%);
  overflow: hidden;
}
.fpc-card:hover,
.fpc-card.active {
  transition: none;
  transform: translate3d(0, 0, 0.1px) rotateX(var(--rotate-y)) rotateY(var(--rotate-x));
}
.fpc-card * {
  display: grid;
  grid-area: 1/-1;
  border-radius: var(--card-radius);
  transform: translate3d(0, 0, 0.1px);
  pointer-events: none;
}
.fpc-inside {
  inset: 1px;
  position: absolute;
  background-image: var(--inner-gradient);
  background-color: #0d0d0d;
  transform: translate3d(0, 0, 0.01px);
}
.fpc-shine {
  mask-image: var(--icon);
  mask-mode: luminance;
  mask-repeat: repeat;
  mask-size: 150%;
  mask-position: top calc(200% - (var(--background-y) * 5)) left calc(100% - var(--background-x));
  transition: filter 0.6s ease;
  filter: brightness(0.66) contrast(1.33) saturate(0.33) opacity(0.5);
  animation: fpc-holo-bg 18s linear infinite;
  mix-blend-mode: color-dodge;
}
.fpc-shine,
.fpc-shine::after {
  --space: 5%;
  --angle: -45deg;
  transform: translate3d(0, 0, 1px);
  overflow: hidden;
  z-index: 3;
  background: transparent;
  background-size: cover;
  background-position: center;
  background-image:
    repeating-linear-gradient(0deg,
      var(--sunpillar-clr-1) calc(var(--space) * 1),
      var(--sunpillar-clr-2) calc(var(--space) * 2),
      var(--sunpillar-clr-3) calc(var(--space) * 3),
      var(--sunpillar-clr-4) calc(var(--space) * 4),
      var(--sunpillar-clr-5) calc(var(--space) * 5),
      var(--sunpillar-clr-6) calc(var(--space) * 6),
      var(--sunpillar-clr-1) calc(var(--space) * 7)),
    repeating-linear-gradient(var(--angle),
      #0d0d0d 0%,
      hsl(28, 25%, 55%) 3.8%,
      hsl(28, 45%, 62%) 4.5%,
      hsl(28, 25%, 55%) 5.2%,
      #0d0d0d 10%,
      #0d0d0d 12%),
    radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y),
      hsla(0, 0%, 0%, 0.1) 12%,
      hsla(0, 0%, 0%, 0.15) 20%,
      hsla(0, 0%, 0%, 0.25) 120%);
  background-position: 0 var(--background-y), var(--background-x) var(--background-y), center;
  background-blend-mode: color, hard-light;
  background-size: 500% 500%, 300% 300%, 200% 200%;
  background-repeat: repeat;
}
.fpc-shine::before,
.fpc-shine::after {
  content: '';
  background-position: center;
  background-size: cover;
  grid-area: 1/1;
  opacity: 0;
}
.fpc-card:hover .fpc-shine,
.fpc-card.active .fpc-shine {
  filter: brightness(0.85) contrast(1.5) saturate(0.6);
  animation: none;
}
.fpc-card:hover .fpc-shine::before,
.fpc-card.active .fpc-shine::before,
.fpc-card:hover .fpc-shine::after,
.fpc-card.active .fpc-shine::after {
  opacity: 1;
}
.fpc-shine::before {
  background-image:
    linear-gradient(45deg,
      var(--sunpillar-4),
      var(--sunpillar-5),
      var(--sunpillar-6),
      var(--sunpillar-1),
      var(--sunpillar-2),
      var(--sunpillar-3)),
    radial-gradient(circle at var(--pointer-x) var(--pointer-y), hsl(28, 35%, 65%) 0%, hsla(28, 30%, 25%, 0.2) 90%),
    var(--grain);
  background-size: 250% 250%, 100% 100%, 220px 220px;
  background-position: var(--pointer-x) var(--pointer-y), center, calc(var(--pointer-x) * 0.01) calc(var(--pointer-y) * 0.01);
  background-blend-mode: color-dodge;
  filter: brightness(calc(2 - var(--pointer-from-center))) contrast(calc(var(--pointer-from-center) + 2)) saturate(calc(0.5 + var(--pointer-from-center)));
  mix-blend-mode: luminosity;
}
.fpc-shine::after {
  background-position: 0 var(--background-y), calc(var(--background-x) * 0.4) calc(var(--background-y) * 0.5), center;
  background-size: 200% 300%, 700% 700%, 100% 100%;
  mix-blend-mode: difference;
  filter: brightness(0.8) contrast(1.5);
}
.fpc-glare {
  transform: translate3d(0, 0, 1.1px);
  overflow: hidden;
  background-image: radial-gradient(farthest-corner circle at var(--pointer-x) var(--pointer-y),
    hsl(28, 80%, 78%) 12%,
    hsla(20, 50%, 18%, 0.8) 90%);
  mix-blend-mode: overlay;
  filter: brightness(0.85) contrast(1.2);
  z-index: 4;
}
.fpc-avatar-content {
  mix-blend-mode: normal;
  overflow: hidden;
}
.fpc-avatar-content .fpc-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
  filter: none;
}
.fpc-avatar-content::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to bottom,
      rgba(0, 0, 0, 0) 55%,
      rgba(0, 0, 0, 0.45) 80%,
      rgba(0, 0, 0, 0.75) 100%);
  pointer-events: none;
}
.fpc-user-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  z-index: 7;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  column-gap: 18px;
  row-gap: 10px;
  background: rgba(20, 20, 20, 0.55);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(249, 115, 22, 0.25);
  border-radius: 15px;
  padding: 12px 14px;
  pointer-events: auto;
  direction: rtl;
}
.fpc-user-details {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
}
.fpc-user-text {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 6px;
  text-align: right;
}
.fpc-handle {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand-orange);
  line-height: 1;
  letter-spacing: 0.2px;
}
.fpc-status {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fpc-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.75);
  display: inline-block;
}
.fpc-contact-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  background-color: var(--brand-orange);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.45);
}
.fpc-contact-btn:hover {
  background-color: var(--brand-orange-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(249, 115, 22, 0.6);
}
.fpc-content {
  max-height: 100%;
  overflow: hidden;
  text-align: center;
  position: relative;
  transform: translate3d(calc(var(--pointer-from-left) * -6px + 3px), calc(var(--pointer-from-top) * -6px + 3px), 0.1px) !important;
  z-index: 5;
  mix-blend-mode: normal;
}
.fpc-details {
  width: 100%;
  position: absolute;
  top: 1.4em;
  display: flex;
  flex-direction: column;
  padding: 0 1.5em;
  direction: rtl;
}
.fpc-details .fpc-name {
  font-weight: 700;
  margin: 0;
  font-size: min(4.5svh, 2.4em);
  line-height: 1.15;
  text-align: right;
  background-image: linear-gradient(to bottom, #ffffff, #f97316);
  background-size: 1em 1.5em;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}
.fpc-details p {
  font-weight: 600;
  position: relative;
  top: 4px;
  font-size: 15px;
  margin: 0;
  text-align: right;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}
.fpc-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--card-radius);
  padding: 1.5px;
  background: conic-gradient(
    from var(--shimmer-angle, 0deg) at 50% 50%,
    #f97316 0%,
    #fbbf24 20%,
    #fcd34d 35%,
    #fbbf24 50%,
    #f97316 65%,
    #ea580c 80%,
    #f97316 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.45;
  z-index: 6;
  animation: fpc-shimmer-rotate 8s linear infinite;
  transition: opacity 0.5s ease, padding 0.5s ease;
}
.fpc-card:hover::after,
.fpc-card.active::after {
  opacity: 0.85;
  padding: 2px;
}
@property --shimmer-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes fpc-shimmer-rotate {
  0% { --shimmer-angle: 0deg; }
  100% { --shimmer-angle: 360deg; }
}
@keyframes fpc-glow-bg {
  0% { --bgrotate: 0deg; }
  100% { --bgrotate: 360deg; }
}
@keyframes fpc-holo-bg {
  0% { background-position: 0 var(--background-y), 0 0, center; }
  100% { background-position: 0 var(--background-y), 90% 90%, center; }
}
@media (max-width: 768px) {
  .fpc-card { height: 70svh; max-height: 450px; }
  .fpc-details { top: 1em; }
  .fpc-details .fpc-name { font-size: min(4svh, 2em); }
  .fpc-details p { font-size: 13px; }
  .fpc-user-info { bottom: 15px; left: 15px; right: 15px; padding: 10px 12px; }
  .fpc-user-details { gap: 10px; }
  .fpc-handle { font-size: 17px; }
  .fpc-status { font-size: 11px; }
  .fpc-contact-btn { padding: 8px 14px; font-size: 13px; }
}
@media (max-width: 480px) {
  .fpc-card { height: 60svh; max-height: 380px; }
  .fpc-details { top: 0.8em; }
  .fpc-details .fpc-name { font-size: min(3.5svh, 1.7em); }
  .fpc-details p { font-size: 12px; }
  .fpc-user-info { bottom: 12px; left: 12px; right: 12px; padding: 10px 12px; border-radius: 14px; }
  .fpc-user-details { gap: 8px; }
  .fpc-handle { font-size: 16px; }
  .fpc-status { font-size: 10px; }
  .fpc-contact-btn { padding: 8px 12px; font-size: 12px; }
}
`;

const DEFAULT_BEHIND_GRADIENT = `radial-gradient(farthest-side circle at var(--pointer-x) var(--pointer-y),hsla(24,100%,70%,var(--card-opacity)) 4%,hsla(28,80%,55%,calc(var(--card-opacity)*0.75)) 10%,hsla(20,60%,40%,calc(var(--card-opacity)*0.5)) 50%,hsla(20,0%,20%,0) 100%),radial-gradient(35% 52% at 55% 20%,#f9731680 0%,#f9731600 100%),radial-gradient(100% 100% at 50% 50%,#fb923c 1%,#f9731600 76%),conic-gradient(from 124deg at 50% 50%,#f97316ff 0%,#fb923cff 40%,#fb923cff 60%,#f97316ff 100%)`;
const DEFAULT_INNER_GRADIENT = `linear-gradient(145deg,#1a1a1a 0%,#0d0d0d 100%)`;

const ANIMATION_CONFIG = {
  SMOOTH_DURATION: 600,
  INITIAL_DURATION: 1500,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20
};

const fpcClamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const fpcRound = (value, precision = 3) => parseFloat(value.toFixed(precision));
const fpcAdjust = (value, fromMin, fromMax, toMin, toMax) =>
  fpcRound(toMin + (toMax - toMin) * (value - fromMin) / (fromMax - fromMin));
const fpcEaseInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function ensureFloatingCardStyles() {
  if (typeof document === `undefined`) return;
  if (document.getElementById(FLOATING_CARD_STYLE_ID)) return;
  const styleEl = document.createElement(`style`);
  styleEl.id = FLOATING_CARD_STYLE_ID;
  styleEl.textContent = FLOATING_CARD_CSS;
  document.head.appendChild(styleEl);
}

const FloatingProductCardComponent = ({
  imageUrl = `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80`,
  name = `חולצת אוברסייז קלאסית`,
  description = `כותנה 100% • גזרה רחבה ונוחה לכל יום`,
  price = `₪149`,
  status = `במלאי • משלוח תוך 48 שעות`,
  buttonText = `הוסף לעגלה`,
  className = ``,
  enableTilt = true,
  enableMobileTilt = false,
  mobileTiltSensitivity = 5,
  onAddToCart,
  onImageLoad
}) => {
  const wrapRef = React.useRef(null);
  const cardRef = React.useRef(null);

  React.useEffect(() => {
    ensureFloatingCardStyles();
  }, []);

  const animationHandlers = React.useMemo(() => {
    if (!enableTilt) return null;
    let rafId = null;
    const updateCardTransform = (offsetX, offsetY, card, wrap) => {
      const width = card.clientWidth;
      const height = card.clientHeight;
      const percentX = fpcClamp(100 / width * offsetX);
      const percentY = fpcClamp(100 / height * offsetY);
      const centerX = percentX - 50;
      const centerY = percentY - 50;
      const properties = {
        '--pointer-x': `${percentX}%`,
        '--pointer-y': `${percentY}%`,
        '--background-x': `${fpcAdjust(percentX, 0, 100, 35, 65)}%`,
        '--background-y': `${fpcAdjust(percentY, 0, 100, 35, 65)}%`,
        '--pointer-from-center': `${fpcClamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        '--pointer-from-top': `${percentY / 100}`,
        '--pointer-from-left': `${percentX / 100}`,
        '--rotate-x': `${fpcRound(-(centerX / 5))}deg`,
        '--rotate-y': `${fpcRound(centerY / 4)}deg`
      };
      Object.entries(properties).forEach(([property, value]) => {
        wrap.style.setProperty(property, value);
      });
    };
    const createSmoothAnimation = (duration, startX, startY, card, wrap) => {
      const startTime = performance.now();
      const targetX = wrap.clientWidth / 2;
      const targetY = wrap.clientHeight / 2;
      const animationLoop = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = fpcClamp(elapsed / duration);
        const easedProgress = fpcEaseInOutCubic(progress);
        const currentX = fpcAdjust(easedProgress, 0, 1, startX, targetX);
        const currentY = fpcAdjust(easedProgress, 0, 1, startY, targetY);
        updateCardTransform(currentX, currentY, card, wrap);
        if (progress < 1) {
          rafId = requestAnimationFrame(animationLoop);
        }
      };
      rafId = requestAnimationFrame(animationLoop);
    };
    return {
      updateCardTransform,
      createSmoothAnimation,
      cancelAnimation: () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };
  }, [enableTilt]);

  const handlePointerMove = React.useCallback((event) => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;
    const rect = card.getBoundingClientRect();
    animationHandlers.updateCardTransform(
      event.clientX - rect.left,
      event.clientY - rect.top,
      card,
      wrap
    );
  }, [animationHandlers]);

  const handlePointerEnter = React.useCallback(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;
    animationHandlers.cancelAnimation();
    wrap.classList.add(`active`);
    card.classList.add(`active`);
  }, [animationHandlers]);

  const handlePointerLeave = React.useCallback((event) => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;
    animationHandlers.createSmoothAnimation(
      ANIMATION_CONFIG.SMOOTH_DURATION,
      event.offsetX,
      event.offsetY,
      card,
      wrap
    );
    wrap.classList.remove(`active`);
    card.classList.remove(`active`);
  }, [animationHandlers]);

  const handleDeviceOrientation = React.useCallback((event) => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;
    const { beta, gamma } = event;
    if (!beta || !gamma) return;
    animationHandlers.updateCardTransform(
      card.clientHeight / 2 + gamma * mobileTiltSensitivity,
      card.clientWidth / 2 + (beta - ANIMATION_CONFIG.DEVICE_BETA_OFFSET) * mobileTiltSensitivity,
      card,
      wrap
    );
  }, [animationHandlers, mobileTiltSensitivity]);

  React.useEffect(() => {
    if (!enableTilt || !animationHandlers) return;
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;
    const handleClick = () => {
      if (!enableMobileTilt || location.protocol !== `https:`) return;
      if (typeof window.DeviceMotionEvent?.requestPermission === `function`) {
        window.DeviceMotionEvent.requestPermission().then((state) => {
          if (state === `granted`) {
            window.addEventListener(`deviceorientation`, handleDeviceOrientation);
          }
        }).catch((err) => console.error(err));
      } else {
        window.addEventListener(`deviceorientation`, handleDeviceOrientation);
      }
    };
    card.addEventListener(`pointerenter`, handlePointerEnter);
    card.addEventListener(`pointermove`, handlePointerMove);
    card.addEventListener(`pointerleave`, handlePointerLeave);
    card.addEventListener(`click`, handleClick);
    const initialX = wrap.clientWidth - ANIMATION_CONFIG.INITIAL_X_OFFSET;
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET;
    animationHandlers.updateCardTransform(initialX, initialY, card, wrap);
    animationHandlers.createSmoothAnimation(
      ANIMATION_CONFIG.INITIAL_DURATION,
      initialX,
      initialY,
      card,
      wrap
    );
    return () => {
      card.removeEventListener(`pointerenter`, handlePointerEnter);
      card.removeEventListener(`pointermove`, handlePointerMove);
      card.removeEventListener(`pointerleave`, handlePointerLeave);
      card.removeEventListener(`click`, handleClick);
      window.removeEventListener(`deviceorientation`, handleDeviceOrientation);
      animationHandlers.cancelAnimation();
    };
  }, [
    enableTilt,
    enableMobileTilt,
    animationHandlers,
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    handleDeviceOrientation
  ]);

  const cardStyle = React.useMemo(() => ({
    '--behind-gradient': DEFAULT_BEHIND_GRADIENT,
    '--inner-gradient': DEFAULT_INNER_GRADIENT
  }), []);

  const handleContactClick = React.useCallback(() => {
    if (onAddToCart) onAddToCart();
  }, [onAddToCart]);

  return (
    <div
      ref={wrapRef}
      className={`fpc-wrapper ${className}`.trim()}
      style={cardStyle}
      dir="rtl">
      <section ref={cardRef} className="fpc-card">
        <div className="fpc-inside">
          <div className="fpc-content fpc-avatar-content">
            {/* SmartImage — same self-healing pattern (3 retries + cache-bust +
                graceful placeholder) used by every other product/mockup image
                in the app. Previously a raw <img> with a destructive onError
                that hid the element forever on a single cold-cache miss, which
                is why the BLOOM "stars" carousel sometimes shipped blank on
                first visit until the user refreshed. */}
            <SmartImage
              className="fpc-avatar"
              src={imageUrl}
              alt={name || `מוצר`}
              loading="lazy"
              decoding="async"
              onLoad={onImageLoad} />
          </div>
          <div className="fpc-shine" />
          <div className="fpc-glare" />
          <div className="fpc-content">
            <div className="fpc-details">
              <div className="fpc-name">{name}</div>
              <p>{description}</p>
            </div>
          </div>
          <div className="fpc-user-info">
            <div className="fpc-user-details">
              <div className="fpc-user-text">
                <div className="fpc-handle"><bdi dir="ltr">{price}</bdi></div>
                <div className="fpc-status">
                  <span className="fpc-status-dot" aria-hidden="true" />
                  {status}
                </div>
              </div>
            </div>
            <button
              className="fpc-contact-btn"
              onClick={handleContactClick}
              style={{ pointerEvents: `auto` }}
              type="button"
              aria-label={buttonText}>
              {buttonText}
            </button>
          </div>
        </div>
      </section>
    </div>);
};

const FloatingProductCard = React.memo(FloatingProductCardComponent);

// BloomCardLite — minimal mobile/reduced-motion variant of FloatingProductCard.
// Same overall layout (image, name, description, price, CTA) but as a plain
// <div> with no rAF tilt loop, no pointer listeners, no holographic shine, no
// mount reveal. Used on screens < 768px to stop the home page flickering when
// the carousel has 12 cards mounted at once.
const BloomCardLite = React.memo(function BloomCardLite({
  imageUrl, name, description, price, status, buttonText, onClick,
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === `Enter` || e.key === ` `) { e.preventDefault(); onClick && onClick(); } }}
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 14,
        cursor: `pointer`,
        display: `flex`,
        flexDirection: `column`,
        gap: 12,
        boxShadow: `0 8px 24px rgba(0,0,0,0.35)`,
      }}>
      {/* BLOOM images are 1414×2000 (≈0.707 w/h, 5:7 portrait) with the orange
          frame baked into the artwork. Match the container to that native ratio
          and use object-fit: contain so the WHOLE framed image is visible
          edge-to-edge with no crop — the orange side bars are part of the image
          and must not be sliced off. Same ratio the desktop .fpc-card uses. */}
      <div style={{
        position: `relative`,
        width: `100%`,
        aspectRatio: `1414 / 2000`,
        background: COLORS.bg,
        borderRadius: 12,
        overflow: `hidden`,
      }}>
        <SmartImage
          src={imageUrl}
          alt={name || ``}
          loading="lazy"
          decoding="async"
          style={{ width: `100%`, height: `100%`, objectFit: `cover`, objectPosition: `center`, display: `block` }}
        />
      </div>
      <div style={{ display: `flex`, flexDirection: `column`, gap: 4 }}>
        <div style={{
          margin: 0,
          color: COLORS.white,
          fontFamily: `'Playfair Display',serif`,
          fontSize: 20,
          letterSpacing: `0.02em`,
          lineHeight: 1.15,
        }}>{name}</div>
        {description && (
          <p style={{
            margin: 0,
            color: COLORS.gray,
            fontFamily: `'Varela Round',sans-serif`,
            fontSize: 12,
            lineHeight: 1.4,
          }}>{description}</p>
        )}
      </div>
      <div style={{
        display: `flex`,
        alignItems: `center`,
        justifyContent: `space-between`,
        gap: 10,
        marginTop: 2,
      }}>
        <div style={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <div style={{ color: COLORS.accent, fontFamily: `'Varela Round',sans-serif`, fontWeight: 700, fontSize: 18 }}><bdi dir="ltr">{price}</bdi></div>
          <div style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 10, letterSpacing: `0.05em`, textTransform: `uppercase` }}>{status}</div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
          style={{
            background: COLORS.accentBtn,
            color: COLORS.white,
            border: `none`,
            borderRadius: 999,
            padding: `10px 18px`,
            fontFamily: `'Varela Round',sans-serif`,
            fontSize: 13,
            fontWeight: 700,
            cursor: `pointer`,
            whiteSpace: `nowrap`,
          }}>{buttonText}</button>
      </div>
    </div>
  );
});

// ============================================================================
// HomeFloatingBloomCarousel — מציג את כל דמויות BLOOM כקרוסלת כרטיסים מרחפים.
// טוען מ-Supabase, מתחלף אוטומטית כל 5 שניות (נעצר ב-hover), עם נקודות + swipe.
// כפתור כל דמות מנווט ל-#pets/<slug> שלה (אותה לוגיקת slug כמו ב-PetsPage).
// ============================================================================
function HomeFloatingBloomCarousel({ lang, setPage }) {
  // `designs` holds the picked 12 actually rendered. `totalCount` is the full
  // count of active BLOOM characters (~70) — used only for the "see all" CTA
  // label so the homepage still advertises the real collection size.
  const [designs, setDesigns] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [isPaused, setIsPaused] = useState(false);
  // Mobile + reduced-motion users get the LIGHT card variant (no tilt, no
  // holographic shine, no rAF mount reveal). Computed once on mount.
  const [reduceFx, setReduceFx] = useState(() => {
    if (typeof window === `undefined`) return false;
    if (window.innerWidth < 768) return true;
    try { return window.matchMedia(`(prefers-reduced-motion: reduce)`).matches; } catch { return false; }
  });

  // Mount-driven reveal for the carousel card. The previous version waited
  // for the image to load — but when the browser had it cached, "load" fired
  // synchronously and React added .is-in before the initial hidden frame ever
  // painted, so the CSS transition was skipped (the card just appeared).
  //
  // Fix: render the wrapper in the hidden state (.bloom-card-reveal without
  // .is-in), then flip .is-in after a guaranteed paint of the hidden state.
  // Double requestAnimationFrame is the canonical "wait for next layout +
  // paint" pattern — the first rAF fires before the upcoming paint, the
  // second fires after it. By the time we setCardRevealed(true), the
  // browser has committed the opacity:0/translateY(36px) starting frame to
  // the screen, so the transition reliably plays on every device and every
  // load (cached or not). The float no longer depends on image timing at all.
  //
  // SAFETY: belt-and-braces 1000ms timer in case rAF never fires (background
  // tab, scheduler oddities). The card is also forced visible by the
  // @media (prefers-reduced-motion: reduce) CSS override.
  // On reduceFx (mobile / reduced-motion) skip the rAF reveal entirely so the
  // card is visible on the first paint — no opacity/translateY animation to
  // schedule, no extra frames to compose.
  const [cardRevealed, setCardRevealed] = useState(() => reduceFx);
  useEffect(() => {
    if (reduceFx) { setCardRevealed(true); return; }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCardRevealed(true));
    });
    const safety = setTimeout(() => setCardRevealed(true), 1000);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(safety);
    };
  }, [reduceFx]);

  // Refs mirror the latest state so the click handler can read activeIdx/designs
  // at click time — not at render time. Without this, each card captures its own
  // slug in a closure and which-button-actually-fires depends on z-stacking quirks
  // of the overlapping cards. With refs, every card's button reads the same source
  // of truth and navigates to whatever character is currently shown.
  const activeIdxRef = useRef(0);
  const designsRef = useRef([]);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);
  useEffect(() => { designsRef.current = designs; }, [designs]);

  // Inject a one-time stylesheet rule that disables pointer events on the entire
  // subtree of inactive cards. Required because FloatingProductCard's button and
  // info bar set inline `pointer-events: auto`, which beats an inline `none` on a
  // wrapper. The !important rule wins over the inline declaration, so clicks on
  // stacked (invisible) cards are blocked and only the visible card is hoverable.
  useEffect(() => {
    if (typeof document === `undefined`) return;
    const STYLE_ID = `bloom-carousel-inactive-styles`;
    if (document.getElementById(STYLE_ID)) return;
    const styleEl = document.createElement(`style`);
    styleEl.id = STYLE_ID;
    styleEl.textContent = `.bloom-carousel-inactive, .bloom-carousel-inactive * { pointer-events: none !important; } .bloom-carousel-inactive, .bloom-carousel-inactive * { animation-play-state: paused !important; }`;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    const handle = () => {
      const mob = window.innerWidth < 768;
      setIsMobile(mob);
      // Keep reduceFx in sync — if the user rotates a tablet across the 768px
      // line mid-session we want the card variant to switch too.
      let mq = false;
      try { mq = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches; } catch {}
      setReduceFx(mob || mq);
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Fisher-Yates in-place shuffle. Reused for the species pools and the
    // final mixed 12 so dogs and cats are interleaved (not "all dogs then all
    // cats") in the visible carousel.
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    };
    // Pick ~6 dogs + ~6 cats; if one species is short, fill from the other
    // (plus any legacy species=NULL rows) so we always hit 12 if the pool is
    // large enough. Final reshuffle so the order isn't "dogs first, cats
    // after" — interleaving keeps the carousel feeling varied.
    const pickBalanced = (all, target = 12, perSide = 6) => {
      const dogs  = shuffle(all.filter(d => d.species === `dog`));
      const cats  = shuffle(all.filter(d => d.species === `cat`));
      const other = shuffle(all.filter(d => d.species !== `dog` && d.species !== `cat`));
      const out = [...dogs.slice(0, perSide), ...cats.slice(0, perSide)];
      if (out.length < target) {
        const leftovers = [...dogs.slice(perSide), ...cats.slice(perSide), ...other];
        out.push(...shuffle(leftovers).slice(0, target - out.length));
      }
      return shuffle(out);
    };
    (async () => {
      setLoadError(false);
      try {
        const { data, error } = await supabase
          .from("pet_designs")
          .select("id,slug,species,name_he,name_en,name_ru,animal_he,animal_en,animal_ru,tagline_he,tagline_en,tagline_ru,price_shirt,price_shirt_basic,mockup_url,mockup_shirt_url,mockup_shirt_white_url,mockup_shirt_black_url,mockup_mug_url,design_url,breed_origin_he,breed_origin_en,breed_origin_ru,breed_facts_he,breed_facts_en,breed_facts_ru")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        if (cancelled || !data) return;
        setTotalCount(data.length);
        // Render only 12 cards (capped DOM + image count is the main flicker
        // fix). Each fresh mount picks a different 12, so the home page rotates
        // exposure across the whole collection over repeat visits.
        setDesigns(pickBalanced(data, 12, 6));
      } catch (err) {
        console.error(`Failed to load BLOOM carousel:`, err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Auto-advance every 5s, paused on hover or while user is mid-swipe.
  useEffect(() => {
    if (isPaused || designs.length <= 1) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % designs.length);
    }, 5000);
    return () => clearInterval(id);
  }, [isPaused, designs.length]);

  // NOTE: we intentionally do NOT early-return when designs is empty. Doing so
  // collapsed the whole showcase to 0px until Supabase responded, then it
  // popped to full height and shoved the hero below it down — the dominant
  // source of the home page's poor CLS (~0.63 desktop). Instead the <section>
  // reserves its loaded height via minHeight (see below) so the empty→loaded
  // fill happens inside already-reserved space and nothing below shifts. The
  // card + dots are inserted (not moved) on load, so they don't shift either.

  const statusByLang = {
    he: `מוצר כוכב · BLOOM`,
    en: `Star product · BLOOM`,
    ru: `Звезда · BLOOM`,
  };
  const buttonByLang = {
    he: `BLOOM →`,
    en: `BLOOM →`,
    ru: `BLOOM →`,
  };
  const eyebrowByLang = {
    he: `הכוכבים שלנו`,
    en: `Our stars`,
    ru: `Наши звёзды`,
  };

  // Defensive name → slug fallback. pet_designs.slug is the canonical
  // identifier (single source of truth); this only kicks in if a row is
  // missing one. All current rows have a slug, so this rarely fires.
  const buildSlug = (name) => {
    const s = (name || ``).toLowerCase().replace(/[^a-z0-9]+/g, `-`).replace(/^-+|-+$/g, ``);
    return s;
  };

  // Single click handler shared by every card in the stack. Reads the latest
  // active index and designs list from refs at click time, so the navigation
  // target always matches the character currently visible — never stale.
  const handleViewActiveCharacter = () => {
    if (typeof setPage === `function`) setPage(`pets`);
  };

  const goPrev = () => setActiveIdx((i) => (i - 1 + designs.length) % designs.length);
  const goNext = () => setActiveIdx((i) => (i + 1) % designs.length);

  return (
    <section
      style={{
        width: `100%`,
        background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.18) 0%, transparent 60%), ${COLORS.bg}`,
        padding: isMobile ? `96px 16px 32px` : `120px 24px 48px`,
        // Reserve the loaded showcase height (measured: 856px desktop / 731px
        // mobile, incl. padding) so the async card never collapses→expands and
        // shoves the hero below it down. This is the loaded height ceiling —
        // the card is svh/width-capped, so content never exceeds it; on shorter
        // viewports minHeight simply holds the space. Prevents ~0.63 home CLS.
        minHeight: isMobile ? 731 : 856,
        display: `flex`,
        flexDirection: `column`,
        alignItems: `center`,
        direction: lang === `he` ? `rtl` : `ltr`,
        boxSizing: `border-box`,
      }}>
      <div
        className="reveal"
        style={{
          display: `inline-block`,
          background: COLORS.accentDim,
          border: `1px solid rgba(255,107,53,0.3)`,
          borderRadius: 100,
          padding: `6px 18px`,
          marginBottom: 20,
          color: COLORS.accent,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: `0.1em`,
          textTransform: `uppercase`,
          fontFamily: `'Varela Round',sans-serif`,
        }}>
        {`✦ ${eyebrowByLang[lang] || eyebrowByLang.he} ✦`}
      </div>

      {/* Image-load-driven reveal wrapper for the entire showcase (carousel +
          dots). Lives OUTSIDE FloatingProductCard's tilt transform so the
          inner card's holographic tilt/auto-animation isn't disturbed.
          Uses the local .bloom-card-reveal class (NOT the global .reveal
          observer) so the float-in waits for the image to load instead of
          for the wrapper to enter the viewport — fixes the "pop in after
          floating" bug on slow phones. */}
      <div className={`bloom-card-reveal${cardRevealed ? ` is-in` : ``}`} style={{
        display: `flex`,
        flexDirection: `column`,
        alignItems: `center`,
        width: `100%`,
      }}>
      {/* Card stack — positioning context for the prev/next arrows. Its width
          must MATCH the rendered card so the arrows (placed just outside its
          left/right edges) are symmetric. The desktop .fpc-card is sized by
          aspect-ratio 0.718 × max-height 540 ≈ 388px, so a 360px stack let the
          card overflow ~28px to the left (anchored right by dir=rtl) and the
          left arrow overlapped it. 388 makes the card fit exactly → equal gaps.
          Mobile uses BloomCardLite (width:100%), so it always fills the stack. */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{
          position: `relative`,
          width: isMobile ? 256 : 388,
          maxWidth: `100%`,
          margin: `0 auto`,
        }}>
        {loadError && designs.length === 0 && (
          <LoadError lang={lang} onRetry={() => setReloadKey((k) => k + 1)} compact />
        )}
        {designs.map((d, idx) => {
          const tagline = d[`tagline_${lang}`] || d.tagline_he || d.tagline_en || ``;
          const animal = d[`animal_${lang}`] || d.animal_he || d.animal_en || ``;
          const description = [tagline, animal].filter(Boolean).join(` · `);
          const displayName = (d.name_en || d.name_he || ``).toUpperCase();
          const isActive = idx === activeIdx;
          return (
            <div
              key={d.id}
              data-bloom-card=""
              className={isActive ? `` : `bloom-carousel-inactive`}
              aria-hidden={!isActive}
              style={{
                position: idx === 0 ? `relative` : `absolute`,
                top: 0,
                left: 0,
                right: 0,
                opacity: isActive ? 1 : 0,
                transition: `opacity 0.3s ease`,
              }}>
              {/* mockup_shirt_url is the new product-on-shirt photo; it
                  rolls out gradually per character. Fall back to mockup_url
                  (clean/hero image) until each row has its shirt mockup.
                  On mobile / reduced-motion we render a light <div> card
                  instead of FloatingProductCard — no tilt rAF, no
                  holographic shine, no pointer listeners, no mount reveal. */}
              {reduceFx ? (
                <BloomCardLite
                  imageUrl={transformImage(d.mockup_shirt_url || d.mockup_url, { width: 1080 })}
                  name={displayName}
                  description={description}
                  price={`₪${Number(d.price_shirt_basic) || Number(d.price_shirt) || 99}`}
                  status={statusByLang[lang] || statusByLang.he}
                  buttonText={buttonByLang[lang] || buttonByLang.he}
                  onClick={handleViewActiveCharacter}
                />
              ) : (
                <FloatingProductCard
                  imageUrl={transformImage(d.mockup_shirt_url || d.mockup_url, { width: 1080 })}
                  name={displayName}
                  description={description}
                  price={`₪${Number(d.price_shirt_basic) || Number(d.price_shirt) || 99}`}
                  status={statusByLang[lang] || statusByLang.he}
                  buttonText={buttonByLang[lang] || buttonByLang.he}
                  onAddToCart={handleViewActiveCharacter}
                />
              )}
            </div>
          );
        })}

        {/* Bare-chevron prev/next arrows — absolute children of the card stack
            so they hug the card edges with a symmetric, deterministic gap.
            insetInlineStart/End flips automatically for RTL; the polyline
            inside the svg is mirrored by lang so direction matches reading
            direction. Siblings of the mapped cards (NOT inside any inactive
            wrapper) so clicks aren't blocked. */}
        {designs.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label={lang === `he` ? `דמות קודמת` : lang === `ru` ? `Предыдущий персонаж` : `Previous character`}
              className="bloom-home-arrow"
              style={{
                position: `absolute`,
                top: `50%`,
                insetInlineStart: isMobile ? -38 : -52,
                transform: `translateY(-50%)`,
                zIndex: 4,
                padding: isMobile ? 6 : 8,
                display: `flex`,
                alignItems: `center`,
                justifyContent: `center`,
                touchAction: `manipulation`,
              }}>
              <svg width={isMobile ? 28 : 22} height={isMobile ? 28 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points={lang === `he` ? `9 18 15 12 9 6` : `15 18 9 12 15 6`} />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label={lang === `he` ? `דמות הבאה` : lang === `ru` ? `Следующий персонаж` : `Next character`}
              className="bloom-home-arrow"
              style={{
                position: `absolute`,
                top: `50%`,
                insetInlineEnd: isMobile ? -38 : -52,
                transform: `translateY(-50%)`,
                zIndex: 4,
                padding: isMobile ? 6 : 8,
                display: `flex`,
                alignItems: `center`,
                justifyContent: `center`,
                touchAction: `manipulation`,
              }}>
              <svg width={isMobile ? 28 : 22} height={isMobile ? 28 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points={lang === `he` ? `15 18 9 12 15 6` : `9 18 15 12 9 6`} />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dots row — direction LTR always so first dot is consistently on the left. */}
      <div
        role="tablist"
        aria-label={lang === `he` ? `בחר דמות` : lang === `ru` ? `Выбрать персонажа` : `Choose character`}
        style={{
          display: `flex`,
          flexWrap: `wrap`,
          justifyContent: `center`,
          gap: 10,
          marginTop: 28,
          maxWidth: 360,
          direction: `ltr`,
        }}>
        {designs.map((d, idx) => {
          const isActive = idx === activeIdx;
          const label = d[`name_${lang}`] || d.name_he || d.name_en || `${idx + 1}`;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => setActiveIdx(idx)}
              style={{
                // Visual pill stays small; the button itself is a larger
                // transparent tap target (min 24px) so it's comfortable to hit
                // on touch without spreading the dots row apart.
                width: isActive ? 36 : 24,
                height: 24,
                minHeight: 24,
                display: `inline-flex`,
                alignItems: `center`,
                justifyContent: `center`,
                background: `transparent`,
                border: `none`,
                cursor: `pointer`,
                padding: 0,
              }}
            >
              <span aria-hidden="true" style={{
                display: `block`,
                width: isActive ? 28 : 10,
                height: 10,
                borderRadius: 999,
                background: isActive ? `#f97316` : `rgba(255,255,255,0.25)`,
                transition: `width 0.3s ease, background-color 0.3s ease`,
              }} />
            </button>
          );
        })}
      </div>

      {/* "See all 70" CTA — total count reflects the full active pool, not the
          12 we render. Picks up bloom.seeAll(n) from LANGS so the wording is
          trilingual and consistent with the rest of the site. */}
      {totalCount > designs.length && typeof setPage === `function` && (
        <button
          type="button"
          onClick={() => setPage(`pets`)}
          style={{
            marginTop: 22,
            background: `transparent`,
            border: `1px solid ${COLORS.accent}`,
            color: COLORS.accent,
            borderRadius: 999,
            padding: `10px 22px`,
            fontFamily: `'Varela Round',sans-serif`,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: `0.05em`,
            cursor: `pointer`,
          }}>
          {(LANGS[lang]?.bloom?.seeAll || LANGS.he.bloom.seeAll)(totalCount)}
        </button>
      )}
      </div>
    </section>
  );
}

const COLORS = {
  bg: "#0f0f0f", bgCard: "#1a1a1a", border: "#2a2a2a",
  accent: "#FF6B35", accentHover: "#ff8255", accentDim: "rgba(255,107,53,0.15)",
  // accentBtn / accentBtnHover: a DARKER orange used ONLY as the FILL of buttons
  // that carry WHITE text, so #fff text reaches WCAG AA (#C0501A on #fff = 4.77:1;
  // hover #A8461A = 5.9:1). The bright `accent` (#FF6B35) stays for icons,
  // borders, dots, dims and orange TEXT on the dark bg (those already pass AA).
  accentBtn: "#C0501A", accentBtnHover: "#A8461A",
  white: "#ffffff", gray: "#888888", grayLight: "#8a8a8a", success: "#4ade80",
};

// Legacy flat shipping fee. Kept for any code path that hasn't been moved
// onto the Locker/Home selector yet (defensive — every active path now uses
// the per-method constants below).
const SHIPPING_PRICE = 30;
// Locker (delivery point pickup) is the cheaper, faster default. Home is
// door-to-door courier. shippingMethod state in OrderPage chooses between
// them; orders.extra_prints.shipping_method records the customer's choice.
const SHIPPING_LOCKER = 20;
const SHIPPING_HOME = 35;
const SHIPPING_RATES = { locker: SHIPPING_LOCKER, home: SHIPPING_HOME };
// Live pet-name personalization for customizable products (mugs + shirts only;
// never stickers/packs). The typed name is printed on the product. It is OPTIONAL
// and FREE — it does NOT affect price. Font + color pickers appear only after a
// name is typed (progressive disclosure); both reset when the name is cleared.
// Persisted to orders.pet_name / pet_name_font / pet_name_color (font NAME + hex,
// or all null when no name). All 5 fonts support Hebrew (loaded in index.html).
const PET_NAME_FONTS = [`Heebo`, `Assistant`, `Secular One`, `Suez One`, `Rubik`];
const PET_NAME_COLORS = [`#FF6B35`, `#1a1a1a`, `#ffffff`, `#e91e8c`, `#7c4dff`, `#0a8f5b`, `#d4a017`];
// Human-readable, trilingual names for each swatch — used as the swatch
// aria-label so screen-reader users hear "Pink" instead of "#e91e8c".
const PET_NAME_COLOR_NAMES = {
  "#FF6B35": { he: `כתום`, en: `Orange`, ru: `Оранжевый` },
  "#1a1a1a": { he: `שחור`, en: `Black`, ru: `Чёрный` },
  "#ffffff": { he: `לבן`, en: `White`, ru: `Белый` },
  "#e91e8c": { he: `ורוד`, en: `Pink`, ru: `Розовый` },
  "#7c4dff": { he: `סגול`, en: `Purple`, ru: `Фиолетовый` },
  "#0a8f5b": { he: `ירוק`, en: `Green`, ru: `Зелёный` },
  "#d4a017": { he: `זהב`, en: `Gold`, ru: `Золотой` },
};
const petColorName = (hex, lang) => (PET_NAME_COLOR_NAMES[hex] && (PET_NAME_COLOR_NAMES[hex][lang] || PET_NAME_COLOR_NAMES[hex].en)) || hex;
const PET_NAME_FONT_DEFAULT = `Heebo`;
const PET_NAME_COLOR_DEFAULT = `#FF6B35`;
// Per-item personalization surcharge: +₪20 when (and only when) a pet name is
// entered. Folded into the cart line's unitPrice so it threads through the cart
// total, the order total, and the stored orders.total; shown to the customer via
// the +₪20 pill and the cart line. Empty name = no surcharge.
const PET_NAME_SURCHARGE = 20;
const hasHebrew = (s) => /[֐-׿]/.test(s || ``);
const ADMIN_EMAIL = "gleb2009@gmail.com";
// Single source of truth for social links — referenced anywhere the Instagram
// profile is linked (Nav, mobile menu, BLOOM page CTA, Footer).
const SOCIAL = { instagram: `https://www.instagram.com/sfalimshop/` };

// ============ BLOOM shirt colors — 5 basic options for the Pet Couture collection ============
const BLOOM_SHIRT_COLORS = [
  { id: `white`, hex: `#ffffff`, he: `לבן`,  en: `White`, ru: `Белый` },
  { id: `black`, hex: `#1a1a1a`, he: `שחור`, en: `Black`, ru: `Чёрный` },
];

// Shared BLOOM shirt option sets — used by both PetModal and BreedPage so the
// shirt type/size picker stays identical in the quick-look modal and the full
// breed page. productId maps the shirt type to its OrderPage product; sizes
// match the PRODUCTS variant ids.
const BLOOM_SHIRT_TYPES = [
  { id: `basic`,     productId: `tshirt`,    label: { he: `בייסיק`,   en: `Basic`,     ru: `Базовая` } },
  { id: `oversized`, productId: `oversized`, label: { he: `אוברסייז`, en: `Oversize`, ru: `Оверсайз` } },
];
const BLOOM_SHIRT_SIZES = [`s`, `m`, `l`, `xl`, `xxl`];

// Resolve a saved hex colour to a readable name (falls back to the hex itself).
const colorName = (hex, lang) => {
  if (!hex) return "";
  const c = BLOOM_SHIRT_COLORS.find(x => x.hex.toLowerCase() === String(hex).toLowerCase());
  return c ? (c[lang] || c.en) : hex;
};

// ============ ANALYTICS CONFIG — fill in your IDs to activate ============
// Get GA4 ID at: https://analytics.google.com  → Admin → Data Streams → Web Stream → Measurement ID
// Get FB Pixel ID at: https://business.facebook.com → Events Manager → Data Sources → Pixel ID
const ANALYTICS = {
  ga4: "G-JCCY177TCN",      // e.g., "G-XXXXXXXXXX"  (leave empty to disable)
  fbPixel: "2048679669402511",  // e.g., "123456789012345" (leave empty to disable)
};

// 🚧 MAINTENANCE MODE — set to true to show "Under Maintenance" page to all visitors.
// Admin (gleb2009@gmail.com) bypasses this when logged in.
// Staff bypass is password-gated on the maintenance page (VITE_STAFF_PASSWORD →
// sessionStorage flag). ?staff=1 only auto-opens that password field; it no
// longer bypasses on its own.
const MAINTENANCE_MODE = true;

// 🔒 MUG STUDIO ACCESS — when false, the #mug-studio route is removed from
// VALID_PAGES (so the hash router falls back to 'home'), the render block
// is short-circuited, the add-to-cart helper no-ops, and the maintenance
// gate no longer makes any exception for it. MugStudio.jsx stays on disk
// and stays code-split — flip to true to re-enable.
const MUG_STUDIO_ENABLED = false;

// 🔒 CUSTOM STICKERS — when false, the round + square "design-your-own"
// sticker products are hidden from the order customizer's product list and
// the Hero showcase grid. Flip to true to re-enable. The PRODUCTS entries,
// LANGS labels, PRODUCT_IDS list, sticker mockup components and PLACEMENTS
// / SIZE_OPTIONS stay intact so: (a) BLOOM character sticker orders
// (PetModal handleOrder("sticker") → addBloomToCart → PRODUCTS.find) keep
// working, (b) historical sticker orders in admin / track still re-render
// their mockups via ProductMockupBase, and (c) localizeProduct still
// translates saved sticker product names across languages.
const CUSTOM_STICKERS_ENABLED = false;

// 👕 Oversize Stone-wash — HIDDEN from the catalog until a real product photo
// exists (it currently reuses the Oversize mockup, so the two look identical).
// The product + all its wiring stay in place; flip this to TRUE to show it in
// the order-wizard grid again (also re-add it to the index.html ItemList JSON-LD).
const STONEWASH_ENABLED = false;

// Friendly, trilingual user-facing error text. The raw error is logged to the
// console for debugging — never surfaced to the customer (no raw e.message).
const uiGenericError = (lang) => lang === `he` ? `משהו השתבש. נסו שוב בעוד רגע.` : lang === `ru` ? `Что-то пошло не так. Попробуйте ещё раз.` : `Something went wrong. Please try again.`;
const uiPaymentError = (lang) => lang === `he` ? `התשלום לא הצליח. בדקו את הפרטים ונסו שוב.` : lang === `ru` ? `Оплата не прошла. Проверьте данные и попробуйте снова.` : `Payment didn't go through — check your details and try again.`;
const uiLoadError = (lang) => lang === `he` ? `לא הצלחנו לטעון. בדקו את החיבור ונסו שוב.` : lang === `ru` ? `Не удалось загрузить. Проверьте соединение и попробуйте снова.` : `Couldn't load. Check your connection and try again.`;
const uiRetry = (lang) => lang === `he` ? `נסו שוב` : lang === `ru` ? `Повторить` : `Try again`;
// Custom-design upload size cap — mirrors the Supabase `designs` bucket limit
// (10 MB). Checked client-side so oversized files are rejected before upload.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const uiFileTooLarge = (lang) => lang === `he` ? `הקובץ גדול מדי (עד 10MB). בחרו קובץ קטן יותר.` : lang === `ru` ? `Файл слишком большой (до 10 МБ). Выберите файл поменьше.` : `File is too large (max 10MB). Please choose a smaller file.`;

// Friendly trilingual "couldn't load — retry" block for customer-facing data
// fetches (mirrors the admin error+reload pattern). onRetry re-runs the fetch.
function LoadError({ lang, onRetry, compact = false }) {
  return (
    <div role="alert" style={{ textAlign: `center`, padding: compact ? `28px 16px` : `60px 20px`, color: `#9a9a9a`, fontFamily: `'Varela Round',sans-serif` }}>
      <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{uiLoadError(lang)}</div>
      <button type="button" onClick={onRetry} style={{ background: `#C0501A`, color: `#fff`, border: `none`, borderRadius: 8, padding: `11px 24px`, fontSize: 14, fontWeight: 700, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{uiRetry(lang)}</button>
    </div>
  );
}

// 💳 PAYMENTS — when false, the "Pay" button shows the existing "coming soon"
// modal (order rows are already inserted in step 3, emails already sent, so
// the experience stays graceful). When true, the same button calls the
// `create-payment` Supabase edge function with { order_id, amount, currency,
// customer, items_summary } and redirects to the Tranzila page it returns.
// Flip to true ONLY after: (a) `create-payment` is deployed, (b) supplier
// number is set in env `TRANZILA_SUPPLIER`, (c) `tranzila-webhook` callback
// flips orders.payment_status correctly in a sandbox test.
const PAYMENTS_ENABLED = true;

// Versioned key for the in-browser cart mirror. Bump the suffix if the cart
// item shape changes in a non-backwards-compatible way, so stale shapes
// don't trip up the new code on a returning visitor.
const CART_STORAGE_KEY = `sxp_cart_v1`;

// Central hash reader. Tranzila (and some redirectors) HTML-encode the ampersand
// in our return URL, so the success hash can arrive as
// `#track?order_group=grp-123&amp;paid=1` — which would make `paid` parse as the
// param `amp;paid` and never be detected. Decode `&amp;` back to `&` BEFORE any
// hash/query parsing, in one place, so it can't bite us anywhere. Always read the
// hash through this helper (never window.location.hash directly) when parsing.
function rawHash() {
  if (typeof window === `undefined`) return ``;
  return (window.location.hash || ``).replace(/&amp;/gi, `&`);
}

const IL_PREFIXES = [
  { value: "050" }, { value: "052" }, { value: "053" },
  { value: "054" }, { value: "055" }, { value: "057" }, { value: "058" },
];

const ORDER_STAGES = [
  { key: "received",  en: "Order Received",    he: "התקבלה הזמנה",     ru: "Заказ получен",      dot: "#6B7280" },
  { key: "design",    en: "In Design",          he: "בעיצוב",            ru: "В дизайне",          dot: "#F59E0B" },
  { key: "printing",  en: "Printing",           he: "בהדפסה",            ru: "В печати",           dot: "#FF6B35" },
  { key: "ready",     en: "Ready to Ship",      he: "מוכן למשלוח",       ru: "Готов к отправке",   dot: "#3B82F6" },
  { key: "shipped",   en: "Shipped",            he: "נשלח",              ru: "Отправлен",          dot: "#8B5CF6" },
  { key: "delivered", en: "Delivered",          he: "נמסר",              ru: "Доставлен",          dot: "#28C878" },
];


// Time helpers
const timeAgo = (dateStr, lang) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return lang === "he" ? "עכשיו" : lang === "ru" ? "только что" : "just now";
  if (diff < 3600) { const m = Math.floor(diff/60); return lang === "he" ? `${m} דקות` : lang === "ru" ? `${m} мин.` : `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff/3600); return lang === "he" ? `${h} שעות` : lang === "ru" ? `${h} ч.` : `${h}h ago`; }
  const d = Math.floor(diff/86400);
  return lang === "he" ? `${d} ימים` : lang === "ru" ? `${d} дн.` : `${d}d ago`;
};

const timeBetween = (start, end, lang) => {
  const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
  if (diff < 3600) { const m = Math.floor(diff/60); return lang === "he" ? `${m} דקות` : lang === "ru" ? `${m} мин.` : `${m} min`; }
  if (diff < 86400) { const h = Math.floor(diff/3600); return lang === "he" ? `${h} שעות` : lang === "ru" ? `${h} ч.` : `${h} hrs`; }
  const d = Math.floor(diff/86400);
  return lang === "he" ? `${d} ימים` : lang === "ru" ? `${d} дн.` : `${d} days`;
};

const LANGS = {
  he: {
    dir: "rtl", label: "HE",
    nav: { home: "בית", order: "הזמנה", pets: "BLOOM", track: "מעקב הזמנה", about: "אודות", login: "כניסה", logout: "יציאה", admin: "ניהול" },
    blogHeroTitle:'הבלוג של ספלים שופ', blogHeroSubtitle:'מדריכים, סיפורים והשראה לאוהבי חיות מחמד', blogReadMore:'המשך לקרוא ←', blogCategoryAll:'הכל', blogCategoryBreeds:'גזעים', blogCategoryGifts:'מתנות', blogCategoryCulture:'תרבות', blogCategoryStories:'סיפורים', blogPublishedOn:'פורסם ב-', blogRelatedProduct:'הספל של הגזע הזה →', blogRelatedPosts:'מאמרים נוספים שיעניינו אותך', blogShareTitle:'שתפו את הפוסט', blogShareWhatsapp:'WhatsApp', blogShareCopy:'העתק קישור', blogShareCopied:'✓ הקישור הועתק', blogQuizCta:'לא בטוח איזה גזע מתאים לך? עבור על החידון →', blogBackToList:'← חזרה לכל המאמרים', navBlog:'בלוג', blogReadMoreBreed:'📖 קרא עוד על הגזע', blogFromOurBlog:'מהבלוג שלנו →', blogEmpty:'עדיין אין מאמרים. בקרוב!', blogNotFound:'המאמר לא נמצא', blogBreadcrumbHome:'בית', blogShareFacebook:'Facebook',
    quiz: { hero_cta: "🐾 קח את חידון BLOOM · גלה איזו חיה אתה", banner_title: "איזו דמות BLOOM אתה?", banner_sub: "11 שאלות קצרות יגלו איזו מ-70 הדמויות הכי מתאימה לאופי שלך.", banner_cta: "קח את החידון →", nav: "חידון" },
    hero: { badge: "הדפסות מותאמות אישית · ישראל 🇮🇱", h1line1: "מעוצב", h1line2: "לסגנון שלך", sub: "חולצות, ספלים, מדבקות — מותאמים אישית עם העיצוב שלך.", cta: "עצב בעצמך ←", ctaSecondary: "עיין באוסף BLOOM", from: "החל מ-₪" },
    trust: { shipping: "משלוח ₪30", delivery: "אספקה 3–10 ימי עסקים", secure: "תשלום מאובטח", returns: "החזרים והחלפות בקלות" },
    badges: { bestseller: "רב מכר", new: "חדש" },
    reviews: { eyebrow: "ביקורות לקוחות", title: "מה אומרים עלינו", aria: "ביקורת לקוח" },
    steps: ["מוצר", "עיצוב", "פרטים", "תשלום", "סיום"],
    product: { title: "בחר מוצר", sub: "מה תרצה להתאים אישית?", options: "אפשרויות", from: "החל מ-₪", continue: "המשך ←" },
    customize: { title: (p) => `התאם: ${p}`, sub: "העלה עיצוב וראה תצוגה מקדימה.", size: "מידה", option: "אפשרות", color: "צבע", design: "העיצוב שלך", uploadTitle: "העלה עיצוב", uploadSub: "PNG, JPG, SVG · רזולוציה גבוהה", uploaded: "עיצוב הועלה ✓", changeFile: "לחץ לשינוי", dragHint: "גרור לשינוי מיקום", designSize: "גודל עיצוב", shipping: "משלוח", total: "סה״כ", back: "← חזרה", continue: "המשך ←" },
    form: { title: "הפרטים שלך", sub: "כמעט סיימנו!", name: "שם מלא *", namePh: "השם שלך", email: "מייל *", emailPh: "your@email.com", phone: "טלפון", phonePh: "1234567", notes: "הערות", notesPh: "בקשות מיוחדות...", qty: "כמות", summary: "סיכום", shipping: "משלוח", total: "סה״כ", paymentNote: "תשלום בשלב הבא", paymentSub: "תשלום מאובטח דרך טרנזילה.", back: "← חזרה", place: "המשך לתשלום ←" },
    payment: { title: "תשלום מאובטח", subtitle: "סקור ואשר את ההזמנה", orderNum: "הזמנה מס׳", summary: "סיכום הזמנה", subtotal: "סכום פריטים", shipping: "משלוח", total: "סה״כ לתשלום", deliveryTo: "כתובת למשלוח", payBtn: "תשלם ", paySuffix: " בבטחה ←", processing: "מעבד...", soonTitle: "מערכת התשלום מגיעה בקרוב", soonSub: "אנחנו בתהליך אישור מול חברת הסליקה. ההזמנה שלך נשמרה ואנחנו ניצור איתך קשר אישית כשהמערכת תפעל.", soonBtn: "סגירה ושמירת הזמנה", cancel: "ביטול הזמנה", editDetails: "← עריכת פרטים", confirmCancel: "האם לבטל את ההזמנה?", securedBy: "מאובטח על ידי", acceptedCards: "אמצעי תשלום:", businessLine: "ספלים שופ · עוסק פטור מס׳ 321630279", trustFast: "תשלום מהיר ומאובטח", trustSSL: "הצפנת SSL 256-bit", trustReturn: "החזרים תוך 14 יום *", trustNoSave: "פרטי כרטיס לא נשמרים אצלנו" },
    confirm: { title: "התשלום אושר!", subtitle: "ההזמנה שלך התקבלה", orderNum: "מספר הזמנה", thanksLine: "תודה {name}! שלחנו אישור לכתובת", whatsNext: "מה קורה עכשיו", step1Title: "אנחנו מתחילים בייצור", step1Sub: "ההזמנה שלך נכנסת לסבב הייצור הקרוב", step2Title: "ייצור: 2-4 ימי עסקים", step2Sub: "הדפסה איכותית של העיצוב שבחרת", step3Title: "משלוח: 1-3 ימי עסקים", step3Sub: "תקבל מספר מעקב באימייל", step4Title: "עדכון על כל שלב", step4Sub: "ניצור איתך קשר בכל שינוי", track: "מעקב אחר ההזמנה", another: "הזמנה נוספת", accountTitle: "פתיחת חשבון", accountDesc: "פתחו חשבון כדי לעקוב אחרי ההזמנה ולעבור לתשלום מהר יותר בפעם הבאה — בלחיצה אחת עם Google.", accountLater: "אולי מאוחר יותר" },
    auth: {
      login: "כניסה", register: "הרשמה", email: "אימייל", password: "סיסמה", name: "שם מלא",
      loginBtn: "כנס", registerBtn: "הירשם", noAccount: "אין לך חשבון?", hasAccount: "כבר רשום?",
      loginTitle: "ברוך הבא חזרה", registerTitle: "צור חשבון",
      generatePw: "🎲 ייצר סיסמה חזקה", showPw: "👁️ הצג", hidePw: "🙈 הסתר",
      copyPw: "העתק", copied: "✓ הועתק!",
      forgotPw: "שכחת סיסמה?", forgotPwTitle: "איפוס סיסמה",
      forgotPwDesc: "הזן את כתובת המייל ונשלח לך קישור איפוס",
      forgotPwBtn: "שלח קישור איפוס", forgotPwSent: "📬 קישור איפוס נשלח למייל!",
      backToLogin: "← חזרה לכניסה",
      magicLink: "שלח לי קישור במייל",
      magicLinkDesc: "ללא סיסמה — תיכנס דרך הקישור במייל",
      magicLinkSent: "📬 קישור נשלח! בדוק את המייל",
      orDivider: "או",
      resetPwTitle: "קביעת סיסמה חדשה",
      newPw: "סיסמה חדשה", confirmPw: "אשר סיסמה",
      setPw: "שמור סיסמה", pwSet: "✓ הסיסמה נקבעה בהצלחה!",
      pwMismatch: "הסיסמאות לא תואמות", pwTooShort: "הסיסמה חייבת להכיל לפחות 8 תווים",
      accountSettings: "הגדרות חשבון", changePassword: "שנה סיסמה", setPassword: "הגדר סיסמה לחשבון",
      setPasswordDesc: "הוסף סיסמה לכניסה מהירה יותר (לא חובה)",
      googleBtn: "המשך עם Google", emailRequired: "אנא הזן מייל למעלה תחילה",
    },
    track: { title: "מעקב הזמנות", sub: "עקוב אחרי ההתקדמות של ההזמנות שלך", noOrders: "אין הזמנות עדיין", order: "הזמנה", status: "סטטוס", date: "תאריך", guestTitle: "מעקב אחר ההזמנה שלך", guestDesc: "לא צריך סיסמה — נשלח לך למייל קישור מאובטח לצפייה בהזמנות שלך.", guestBtn: "שלח לי קישור" },
    approval: { submittedTitle: "העיצוב נשלח לאישור", submittedDesc: "העיצוב שלך נשלח לאישור — נעדכן אותך במייל ברגע שהוא יאושר, ואז תוכל לשלם. ההזמנה נשמרה.", underReview: "העיצוב בבדיקה", underReviewDesc: "שלחנו את העיצוב שלך לאישור. נעדכן אותך במייל ברגע שהוא יאושר — ואז אפשר יהיה לשלם.", approvedTitle: "העיצוב אושר! 🎉", approvedDesc: "אפשר להשלים את התשלום וההזמנה תיכנס להפקה.", payNow: "שלם עכשיו", changesTitle: "נדרשים שינויים בעיצוב", reviewNote: "הערה מהצוות שלנו", editResubmit: "ערוך ושלח מחדש", uploadNew: "העלה עיצוב חדש (לא חובה)", resubmitBtn: "שלח מחדש לאישור", resubmitting: "שולח...", resubmitted: "נשלח מחדש — העיצוב בבדיקה שוב", cancelOrder: "בטל הזמנה", cancelConfirm: "לבטל את ההזמנה הזו?", cancelled: "ההזמנה בוטלה" },
    admin: { title: "לוח ניהול", orders: "הזמנות", total: "סה״כ", statuses: { received: "התקבלה", design: "בעיצוב", printing: "בהדפסה", ready: "מוכן", shipped: "נשלח", delivered: "נמסר" }, customer: "לקוח", updateStatus: "עדכן סטטוס", noOrders: "אין הזמנות" },
    products: { tshirt: "חולצת טי בייסיק", oversized: "חולצת אוברסייז", stonewash: "חולצת אוברסייז סטון ווש", dryfit: "חולצת דרייפיט", mug: "ספל", sticker: "מדבקה עגולה", sticker_sq: "מדבקה מרובעת" },
    variants: { standard: "סטנדרט 11oz", large: "גדול 15oz", magic: "משנה צבע", small: "קטן 5×5 ס״מ", medium: "בינוני 10×10 ס״מ", largeS: "גדול 15×15 ס״מ", sheet: "גיליון מדבקות" },
    bloom: { collection: "אוסף", instagramAria: "אינסטגרם", closeModal: "סגור", seeAll: (n) => `ראה את כל ה-${n} →` },
  },
  en: {
    dir: "ltr", label: "EN",
    nav: { home: "Home", order: "Order", pets: "BLOOM", track: "Track Order", about: "About", login: "Login", logout: "Logout", admin: "Admin" },
    blogHeroTitle:'Sfalim Shop Blog', blogHeroSubtitle:'Guides, stories, and inspiration for pet lovers', blogReadMore:'Continue reading →', blogCategoryAll:'All', blogCategoryBreeds:'Breeds', blogCategoryGifts:'Gifts', blogCategoryCulture:'Culture', blogCategoryStories:'Stories', blogPublishedOn:'Published on ', blogRelatedProduct:'The mug for this breed →', blogRelatedPosts:'More articles you might enjoy', blogShareTitle:'Share', blogShareWhatsapp:'WhatsApp', blogShareCopy:'Copy link', blogShareCopied:'✓ Link copied', blogQuizCta:'Not sure which breed fits you? Take the quiz →', blogBackToList:'← Back to all articles', navBlog:'Blog', blogReadMoreBreed:'📖 Read more about the breed', blogFromOurBlog:'From our blog →', blogEmpty:'No articles yet. Coming soon!', blogNotFound:'Article not found', blogBreadcrumbHome:'Home', blogShareFacebook:'Facebook',
    quiz: { hero_cta: "🐾 Take the BLOOM quiz · Which pet are you?", banner_title: "Which BLOOM pet are you?", banner_sub: "11 quick questions reveal which of our 70 characters fits you best.", banner_cta: "Take the quiz →", nav: "Quiz" },
    hero: { badge: "Custom Prints · Made in Israel 🇮🇱", h1line1: "Designed", h1line2: "for your style", sub: "T-shirts, mugs, stickers — fully customized with your design.", cta: "Design your own →", ctaSecondary: "Browse the BLOOM collection", from: "from ₪" },
    trust: { shipping: "Shipping ₪30", delivery: "Delivery 3–10 business days", secure: "Secure payment", returns: "Easy returns & exchanges" },
    badges: { bestseller: "Bestseller", new: "New" },
    reviews: { eyebrow: "Customer reviews", title: "What customers say", aria: "Customer review" },
    steps: ["Product", "Customize", "Details", "Payment", "Done"],
    product: { title: "Choose your product", sub: "What would you like to customize?", options: "options", from: "from ₪", continue: "Continue →" },
    customize: { title: (p) => `Customize: ${p}`, sub: "Upload your design and preview it.", size: "Size", option: "Option", color: "Color", design: "Your Design", uploadTitle: "Upload design", uploadSub: "PNG, JPG, SVG · High resolution", uploaded: "Design uploaded ✓", changeFile: "Click to change", dragHint: "Drag to reposition", designSize: "Design Size", shipping: "Shipping", total: "Total", back: "← Back", continue: "Continue →" },
    form: { title: "Your details", sub: "Almost there!", name: "Full Name *", namePh: "Your name", email: "Email *", emailPh: "your@email.com", phone: "Phone", phonePh: "1234567", notes: "Notes", notesPh: "Special requests...", qty: "Quantity", summary: "Summary", shipping: "Shipping", total: "Total", paymentNote: "Payment on next step", paymentSub: "Secure payment via Tranzila.", back: "← Back", place: "Continue to Payment →" },
    payment: { title: "Secure Payment", subtitle: "Review and confirm your order", orderNum: "Order #", summary: "Order Summary", subtotal: "Subtotal", shipping: "Shipping", total: "Total to Pay", deliveryTo: "Delivery Address", payBtn: "Pay ", paySuffix: " Securely →", processing: "Processing...", soonTitle: "Payment system coming soon", soonSub: "We're finalizing setup with our payment processor. Your order is saved and we'll personally contact you when the system is live.", soonBtn: "Close and save order", cancel: "Cancel Order", editDetails: "← Edit Details", confirmCancel: "Cancel this order?", securedBy: "Secured by", acceptedCards: "We accept:", businessLine: "Sfalim Shop · Exempt Dealer No. 321630279", trustFast: "Fast and secure payment", trustSSL: "256-bit SSL encryption", trustReturn: "14-day returns *", trustNoSave: "We never store card details" },
    confirm: { title: "Payment Confirmed!", subtitle: "Your order has been received", orderNum: "Order Number", thanksLine: "Thanks {name}! Confirmation sent to", whatsNext: "What happens next", step1Title: "We start production", step1Sub: "Your order enters the next production batch", step2Title: "Production: 2-4 business days", step2Sub: "Quality printing of your chosen design", step3Title: "Shipping: 1-3 business days", step3Sub: "You'll receive tracking info by email", step4Title: "Updates at every step", step4Sub: "We'll contact you with any changes", track: "Track Order", another: "New Order", accountTitle: "Create an account", accountDesc: "Create an account to track your order and check out faster next time — one tap with Google.", accountLater: "Maybe later" },
    auth: {
      login: "Login", register: "Register", email: "Email", password: "Password", name: "Full Name",
      loginBtn: "Login", registerBtn: "Register", noAccount: "No account?", hasAccount: "Already registered?",
      loginTitle: "Welcome back", registerTitle: "Create account",
      generatePw: "🎲 Generate strong password", showPw: "👁️ Show", hidePw: "🙈 Hide",
      copyPw: "Copy", copied: "✓ Copied!",
      forgotPw: "Forgot password?", forgotPwTitle: "Reset password",
      forgotPwDesc: "Enter your email and we'll send you a reset link",
      forgotPwBtn: "Send reset link", forgotPwSent: "📬 Reset link sent to your email!",
      backToLogin: "← Back to login",
      magicLink: "Email me a magic link",
      magicLinkDesc: "No password — sign in via the link in your email",
      magicLinkSent: "📬 Link sent! Check your email",
      orDivider: "or",
      resetPwTitle: "Set new password",
      newPw: "New password", confirmPw: "Confirm password",
      setPw: "Save password", pwSet: "✓ Password set successfully!",
      pwMismatch: "Passwords don't match", pwTooShort: "Password must be at least 8 characters",
      accountSettings: "Account Settings", changePassword: "Change password", setPassword: "Set account password",
      setPasswordDesc: "Add a password for faster sign-in (optional)",
      googleBtn: "Continue with Google", emailRequired: "Please enter your email above first",
    },
    track: { title: "Order Tracking", sub: "Follow the progress of your orders", noOrders: "No orders yet", order: "Order", status: "Status", date: "Date", guestTitle: "Track your order", guestDesc: "No password needed — we'll email you a secure link to view your orders.", guestBtn: "Send me the link" },
    approval: { submittedTitle: "Your design was submitted for approval", submittedDesc: "Your design was submitted for approval — we'll email you once it's approved, then you can pay. Your order is saved.", underReview: "Design under review", underReviewDesc: "We've sent your design for approval. We'll email you the moment it's approved — then you can pay.", approvedTitle: "Design approved! 🎉", approvedDesc: "Complete payment and your order goes into production.", payNow: "Pay now", changesTitle: "Changes requested", reviewNote: "Note from our team", editResubmit: "Edit & resubmit", uploadNew: "Upload a new design (optional)", resubmitBtn: "Resubmit for approval", resubmitting: "Submitting...", resubmitted: "Resubmitted — under review again", cancelOrder: "Cancel order", cancelConfirm: "Cancel this order?", cancelled: "Order cancelled" },
    admin: { title: "Admin Dashboard", orders: "Orders", total: "total", statuses: { received: "Received", design: "Design", printing: "Printing", ready: "Ready", shipped: "Shipped", delivered: "Delivered" }, customer: "Customer", updateStatus: "Update Status", noOrders: "No orders yet" },
    products: { tshirt: "Basic T-Shirt", oversized: "Oversize T-Shirt", stonewash: "Oversize Stone-wash Shirt", dryfit: "Dri-FIT T-Shirt", mug: "Custom Mug", sticker: "Round Sticker", sticker_sq: "Square Sticker" },
    variants: { standard: "Standard 11oz", large: "Large 15oz", magic: "Magic Color Change", small: "Small 5×5cm", medium: "Medium 10×10cm", largeS: "Large 15×15cm", sheet: "Sticker Sheet" },
    bloom: { collection: "Collection", instagramAria: "Instagram", closeModal: "Close", seeAll: (n) => `See all ${n} →` },
  },
  ru: {
    dir: "ltr", label: "RU",
    nav: { home: "Главная", order: "Заказ", pets: "BLOOM", track: "Отследить", about: "О нас", login: "Войти", logout: "Выйти", admin: "Админ" },
    blogHeroTitle:'Блог Sfalim Shop', blogHeroSubtitle:'Гиды, истории и вдохновение для любителей питомцев', blogReadMore:'Читать далее →', blogCategoryAll:'Все', blogCategoryBreeds:'Породы', blogCategoryGifts:'Подарки', blogCategoryCulture:'Культура', blogCategoryStories:'Истории', blogPublishedOn:'Опубликовано ', blogRelatedProduct:'Кружка этой породы →', blogRelatedPosts:'Другие статьи', blogShareTitle:'Поделиться', blogShareWhatsapp:'WhatsApp', blogShareCopy:'Копировать ссылку', blogShareCopied:'✓ Ссылка скопирована', blogQuizCta:'Не уверены, какая порода вам подходит? Пройдите тест →', blogBackToList:'← Назад к статьям', navBlog:'Блог', blogReadMoreBreed:'📖 Подробнее о породе', blogFromOurBlog:'Из нашего блога →', blogEmpty:'Пока нет статей. Скоро!', blogNotFound:'Статья не найдена', blogBreadcrumbHome:'Главная', blogShareFacebook:'Facebook',
    quiz: { hero_cta: "🐾 Пройди BLOOM-квиз · Какое ты животное?", banner_title: "Какое ты BLOOM-животное?", banner_sub: "11 коротких вопросов раскроют, какой из 70 персонажей подходит тебе больше всего.", banner_cta: "Пройти квиз →", nav: "Квиз" },
    hero: { badge: "Индивидуальная печать · Израиль 🇮🇱", h1line1: "Создано", h1line2: "в вашем стиле", sub: "Футболки, кружки, стикеры — с вашим дизайном.", cta: "Создать свой →", ctaSecondary: "Каталог BLOOM", from: "от ₪" },
    trust: { shipping: "Доставка ₪30", delivery: "Срок 3–10 рабочих дней", secure: "Безопасная оплата", returns: "Лёгкий возврат и обмен" },
    badges: { bestseller: "Хит продаж", new: "Новинка" },
    reviews: { eyebrow: "Отзывы клиентов", title: "Что говорят о нас", aria: "Отзыв клиента" },
    steps: ["Товар", "Дизайн", "Детали", "Оплата", "Готово"],
    product: { title: "Выберите товар", sub: "Что хотите настроить?", options: "варианта", from: "от ₪", continue: "Продолжить →" },
    customize: { title: (p) => `Настройте: ${p}`, sub: "Загрузите дизайн и посмотрите превью.", size: "Размер", option: "Вариант", color: "Цвет", design: "Ваш дизайн", uploadTitle: "Загрузить дизайн", uploadSub: "PNG, JPG, SVG · Высокое разрешение", uploaded: "Дизайн загружен ✓", changeFile: "Нажмите для изменения", dragHint: "Перетащите для позиции", designSize: "Размер дизайна", shipping: "Доставка", total: "Итого", back: "← Назад", continue: "Продолжить →" },
    form: { title: "Ваши данные", sub: "Почти готово!", name: "Полное имя *", namePh: "Ваше имя", email: "Email *", emailPh: "your@email.com", phone: "Телефон", phonePh: "1234567", notes: "Заметки", notesPh: "Особые пожелания...", qty: "Количество", summary: "Итог", shipping: "Доставка", total: "Итого", paymentNote: "Оплата на следующем шаге", paymentSub: "Безопасная оплата через Tranzila.", back: "← Назад", place: "Перейти к оплате →" },
    payment: { title: "Безопасная оплата", subtitle: "Проверьте и подтвердите заказ", orderNum: "Заказ №", summary: "Сводка заказа", subtotal: "Промежуточный итог", shipping: "Доставка", total: "Итого к оплате", deliveryTo: "Адрес доставки", payBtn: "Оплатить ", paySuffix: " безопасно →", processing: "Обработка...", soonTitle: "Платёжная система скоро запустится", soonSub: "Мы завершаем настройку с провайдером платежей. Ваш заказ сохранён, мы свяжемся с вами лично, когда система заработает.", soonBtn: "Закрыть и сохранить заказ", cancel: "Отменить заказ", editDetails: "← Изменить данные", confirmCancel: "Отменить заказ?", securedBy: "Защищено", acceptedCards: "Способы оплаты:", businessLine: "Sfalim Shop · Освобождённый предприниматель № 321630279", trustFast: "Быстрая и безопасная оплата", trustSSL: "256-bit SSL шифрование", trustReturn: "Возврат в течение 14 дней *", trustNoSave: "Мы не сохраняем данные карты" },
    confirm: { title: "Оплата подтверждена!", subtitle: "Ваш заказ получен", orderNum: "Номер заказа", thanksLine: "Спасибо {name}! Подтверждение отправлено на", whatsNext: "Что дальше", step1Title: "Начинаем производство", step1Sub: "Ваш заказ попадает в ближайшую партию", step2Title: "Производство: 2-4 рабочих дня", step2Sub: "Качественная печать вашего дизайна", step3Title: "Доставка: 1-3 рабочих дня", step3Sub: "Вы получите трек-номер на email", step4Title: "Обновления на каждом этапе", step4Sub: "Мы свяжемся при любых изменениях", track: "Отследить заказ", another: "Новый заказ", accountTitle: "Создать аккаунт", accountDesc: "Создайте аккаунт, чтобы отслеживать заказ и оформлять покупки быстрее в следующий раз — в одно касание через Google.", accountLater: "Может быть позже" },
    auth: {
      login: "Войти", register: "Регистрация", email: "Email", password: "Пароль", name: "Полное имя",
      loginBtn: "Войти", registerBtn: "Зарегистрироваться", noAccount: "Нет аккаунта?", hasAccount: "Уже есть аккаунт?",
      loginTitle: "С возвращением", registerTitle: "Создать аккаунт",
      generatePw: "🎲 Создать надёжный пароль", showPw: "👁️ Показать", hidePw: "🙈 Скрыть",
      copyPw: "Копировать", copied: "✓ Скопировано!",
      forgotPw: "Забыли пароль?", forgotPwTitle: "Сброс пароля",
      forgotPwDesc: "Введите email и мы отправим ссылку для сброса",
      forgotPwBtn: "Отправить ссылку", forgotPwSent: "📬 Ссылка отправлена на email!",
      backToLogin: "← Вернуться ко входу",
      magicLink: "Войти по ссылке из email",
      magicLinkDesc: "Без пароля — войдите по ссылке из письма",
      magicLinkSent: "📬 Ссылка отправлена! Проверьте почту",
      orDivider: "или",
      resetPwTitle: "Установить новый пароль",
      newPw: "Новый пароль", confirmPw: "Подтвердите пароль",
      setPw: "Сохранить пароль", pwSet: "✓ Пароль установлен!",
      pwMismatch: "Пароли не совпадают", pwTooShort: "Пароль должен быть не менее 8 символов",
      accountSettings: "Настройки аккаунта", changePassword: "Изменить пароль", setPassword: "Установить пароль",
      setPasswordDesc: "Добавьте пароль для быстрого входа (необязательно)",
      googleBtn: "Продолжить с Google", emailRequired: "Сначала введите email выше",
    },
    track: { title: "Отслеживание заказов", sub: "Следите за прогрессом ваших заказов", noOrders: "Заказов пока нет", order: "Заказ", status: "Статус", date: "Дата", guestTitle: "Отслеживание заказа", guestDesc: "Пароль не нужен — мы отправим вам на email защищённую ссылку для просмотра ваших заказов.", guestBtn: "Отправить ссылку" },
    approval: { submittedTitle: "Ваш дизайн отправлен на одобрение", submittedDesc: "Ваш дизайн отправлен на одобрение — мы сообщим по email, как только он будет одобрен, тогда можно оплатить. Заказ сохранён.", underReview: "Дизайн на проверке", underReviewDesc: "Мы отправили ваш дизайн на одобрение. Сообщим по email, как только он будет одобрен — тогда можно оплатить.", approvedTitle: "Дизайн одобрен! 🎉", approvedDesc: "Завершите оплату, и заказ отправится в производство.", payNow: "Оплатить", changesTitle: "Требуются изменения", reviewNote: "Комментарий нашей команды", editResubmit: "Изменить и отправить снова", uploadNew: "Загрузить новый дизайн (необязательно)", resubmitBtn: "Отправить на одобрение снова", resubmitting: "Отправка...", resubmitted: "Отправлено повторно — снова на проверке", cancelOrder: "Отменить заказ", cancelConfirm: "Отменить этот заказ?", cancelled: "Заказ отменён" },
    admin: { title: "Панель администратора", orders: "Заказов", total: "всего", statuses: { received: "Получен", design: "Дизайн", printing: "Печать", ready: "Готов", shipped: "Отправлен", delivered: "Доставлен" }, customer: "Клиент", updateStatus: "Обновить статус", noOrders: "Заказов нет" },
    products: { tshirt: "Базовая футболка", oversized: "Оверсайз футболка", stonewash: "Футболка оверсайз стоунвош", dryfit: "Dri-FIT футболка", mug: "Кружка", sticker: "Круглый стикер", sticker_sq: "Квадратный стикер" },
    variants: { standard: "Стандарт 11oz", large: "Большой 15oz", magic: "Меняет цвет", small: "Маленький 5×5см", medium: "Средний 10×10см", largeS: "Большой 15×15см", sheet: "Лист стикеров" },
    bloom: { collection: "Коллекция", instagramAria: "Инстаграм", closeModal: "Закрыть", seeAll: (n) => `Смотреть все ${n} →` },
  },
};

// === Business info & legal policies ===
const BUSINESS_INFO = {
  name: { he: "ספלים שופ", en: "Sfalim Shop", ru: "Sfalim Shop" },
  tagline: { he: "מעוצב לסגנון שלך", en: "Designed for Your Style", ru: "Создано в вашем стиле" },
  vatId: "321630279", // עוסק פטור
  address: { he: "רח׳ י\"א הספורטאים 28, באר שבע", en: "11 HaSportaim St. 28, Be'er Sheva, Israel", ru: "ул. 11 Спортсменов 28, Беэр-Шева, Израиль" },
  phone: "050-484-7874",
  phoneIntl: "+972504847874", // E.164 form for tel: links
  email: "hello@sfalimshop.com",
  website: "www.sfalimshop.com",
};

const POLICY_SECTIONS = [
  { id: "refund",        title: { he: "החזרים וביטולים", en: "Refunds & Cancellations", ru: "Возвраты и отмены" } },
  { id: "shipping",      title: { he: "משלוחים",          en: "Shipping",                ru: "Доставка" } },
  { id: "privacy",       title: { he: "פרטיות",           en: "Privacy",                 ru: "Конфиденциальность" } },
  { id: "terms",         title: { he: "תקנון",            en: "Terms of Service",        ru: "Условия использования" } },
  { id: "accessibility", title: { he: "נגישות",            en: "Accessibility",           ru: "Доступность" } },
];

const POLICIES = {
  he: {
    refund: [
      { type: "p", text: "מדיניות זו מנוסחת על פי חוק הגנת הצרכן, התשמ\"א-1981 ותקנותיו." },
      { type: "h", text: "1. זכות ביטול כללית" },
      { type: "p", text: "לקוח רשאי לבטל עסקה תוך 14 ימים מיום קבלת המוצר, ובלבד שלא נעשה במוצר שימוש ולא נפגם." },
      { type: "h", text: "2. ⚠️ מוצרים בעיצוב אישי — אין זכות ביטול" },
      { type: "p", text: "על פי תקנה 6(ב)(1) לחוק הגנת הצרכן, לא ניתן לבטל עסקה עבור חולצות, ספלים, מדבקות ומוצרים אחרים שעוצבו בהתאמה אישית ללקוח (Print-on-Demand). ברגע שהזמנת מוצר עם עיצוב משלך — אין ביטול ואין החזר כספי." },
      { type: "h", text: "3. החזר במקרים מיוחדים" },
      { type: "p", text: "נחזיר תמורה גם למוצרים בעיצוב אישי במקרים אלה:" },
      { type: "l", items: ["פגם במוצר או באיכות ההדפסה", "טעות בהזמנה מצדנו", "מוצר שלא הגיע תוך 21 ימי עסקים"] },
      { type: "p", text: "אנא צרו עמנו קשר תוך 3 ימי עסקים מקבלת המוצר עם תמונות הפגם ומספר ההזמנה." },
      { type: "h", text: "4. תהליך ההחזר" },
      { type: "p", text: "ההחזר הכספי יבוצע תוך 7 ימי עסקים דרך אותו אמצעי תשלום. החלפת מוצר — שליחת מוצר חליפי תוך 7-14 ימי עסקים." },
      { type: "h", text: "5. דמי ביטול" },
      { type: "p", text: "במקרה של ביטול עסקה כדין, רשאי בית העסק לגבות דמי ביטול בשיעור 5% ממחיר העסקה או 100₪ — הנמוך מביניהם." },
      { type: "h", text: "6. הארכת זכות ביטול לאוכלוסיות מסוימות" },
      { type: "p", text: "אדם עם מוגבלות, אזרח ותיק (בן 65 ומעלה) או עולה חדש רשאי לבטל עסקה בתוך 4 חודשים מיום העסקה או מקבלת המוצר (לפי המאוחר), בכפוף לתנאי החוק ובהצגת תעודה מתאימה. הסייג לגבי מוצרים בעיצוב/התאמה אישית חל גם במקרים אלה." },
      { type: "h", text: "7. ביטול מצד בית העסק" },
      { type: "p", text: "ספלים שופ שומרת על הזכות לבטל הזמנה ולהחזיר את הכסף במקרים של חוסר במלאי, שגיאה במחיר, חשד להונאה, או תוכן פוגעני/אלים/המפר זכויות יוצרים." },
      { type: "p", text: "עודכן לאחרונה: 02.06.2026" },
    ],
    shipping: [
      { type: "h", text: "אזורי שירות" },
      { type: "p", text: "ספלים שופ שולחת לכל אזורי ישראל. משלוחים לחו\"ל — בתיאום מיוחד." },
      { type: "h", text: "זמני אספקה" },
      { type: "l", items: ["3-10 ימי עסקים לרוב היעדים", "עד 14 ימי עסקים בעת עומס או הדפסה מיוחדת", "מועד האספקה מתחיל מיום אישור התשלום", "ימי שישי, שבת וחגים אינם נחשבים ימי עסקים"] },
      { type: "h", text: "דמי משלוח" },
      { type: "p", text: "30₪ — תעריף אחיד למרבית האזורים. אזורים מרוחקים (ערבה, הר חרמון, יישובי קו עימות) — ייתכן חיוב נוסף שיתואם מראש." },
      { type: "h", text: "איסוף עצמי" },
      { type: "p", text: "ניתן לתאם איסוף עצמי מבאר שבע — ללא עלות. צרו קשר טלפונית לתיאום." },
      { type: "h", text: "התעכבות במשלוח" },
      { type: "p", text: "אם החבילה לא הגיעה תוך 21 ימי עסקים, אנא צרו קשר ונדאג לפתרון — משלוח חוזר או החזר כספי מלא." },
      { type: "p", text: "עודכן לאחרונה: 02.06.2026" },
    ],
    privacy: [
      { type: "h", text: "איזה מידע אנחנו אוספים" },
      { type: "l", items: ["מידע אישי: שם מלא, אימייל, טלפון, כתובת למשלוח", "מידע על ההזמנה: מוצרים, עיצובים, הערות", "מידע טכני (אוטומטי): IP, סוג דפדפן, Cookies בסיסיים"] },
      { type: "h", text: "מטרת איסוף המידע" },
      { type: "l", items: ["ביצוע ההזמנה והאספקה", "תקשורת עם הלקוח", "תמיכה ופניות", "שיפור השירות", "עמידה בדרישות חוק"] },
      { type: "p", text: "מסירת המידע תלויה ברצונך, אך ללא הפרטים הנדרשים (שם, כתובת, פרטי קשר) לא נוכל לעבד ולשלוח את הזמנתך." },
      { type: "h", text: "מה אנחנו לא עושים" },
      { type: "l", items: ["לא נמכור את פרטיך לצדדים שלישיים", "לא נשלח ספאם ללא הסכמה", "לא נשמור פרטי אשראי (התשלום דרך Tranzila — חברה מאובטחת PCI-DSS)"] },
      { type: "h", text: "אבטחת מידע" },
      { type: "p", text: "האתר מאובטח ב-SSL (HTTPS). בסיס הנתונים מאוחסן ב-Supabase עם הצפנה. פרטי תשלום עוברים ישירות ל-Tranzila." },
      { type: "h", text: "הצהרת PCI DSS — אבטחת כרטיסי אשראי" },
      { type: "p", text: "ספלים שופ מצהירה על עמידה בדרישות האבטחה של ארגוני כרטיסי האשראי ובתקן PCI DSS:" },
      { type: "l", items: ["בית העסק אינו שומר פרטי כרטיסי אשראי במערכות שלו או באופן ידני כלשהו", "ספק דף התשלום המאובטח שלנו הוא Tranzila — חברה מוסמכת PCI DSS Level 1, רמת האבטחה הגבוהה ביותר בתעשייה", "פרטי האשראי נשלחים ישירות מהלקוח ל-Tranzila בערוץ מוצפן (SSL/TLS)", "אנו לא רואים, לא שומרים, ולא יכולים לגשת לפרטי האשראי בשום שלב"] },
      { type: "h", text: `אחסון ועיבוד מידע בחו"ל` },
      { type: "p", text: `חלק משירותי האתר מסופקים על ידי ספקים המאחסנים ומעבדים מידע מחוץ לישראל: Supabase (אחסון בסיס הנתונים — שמות, הזמנות, פרטי קשר), Vercel (אירוח האתר), ו-Tranzila (עיבוד תשלומים — חברה ישראלית; פרטי האשראי אינם נשמרים אצלנו). בעצם השימוש באתר ומסירת פרטיך, אתה מאשר את העברת המידע ואחסונו אצל ספקים אלה, לרבות מחוץ לישראל. אנו פועלים מול ספקים המחויבים לאמצעי הצפנה והגנה מקובלים, והמידע מועבר אך ורק לצורך תפעול האתר וביצוע ההזמנה.` },
      { type: "h", text: "שיתוף מידע עם צדדים שלישיים" },
      { type: "p", text: "המידע ישותף אך ורק עם חברת השליחים (לאספקה), Tranzila (לתשלום), ורשויות החוק אם נדרש בצו." },
      { type: "h", text: "הזכויות שלך" },
      { type: "p", text: "יש לך זכות לעיין, לתקן, למחוק ולקבל את המידע שלך. לבקשה — שלח אימייל ל-hello@sfalimshop.com." },
      { type: "p", text: "עודכן לאחרונה: 02.06.2026" },
    ],
    terms: [
      { type: "h", text: "כללי" },
      { type: "p", text: "השימוש באתר מהווה הסכמה לתנאי תקנון זה. בית העסק רשאי לעדכן את התקנון בכל עת." },
      { type: "h", text: "כשרות לרכישה" },
      { type: "p", text: "מינימום גיל 18 (או באישור הורה). חובת מסירת פרטים אמיתיים ומלאים." },
      { type: "h", text: "הזמנות ותשלום" },
      { type: "p", text: `ההזמנה נחשבת מאושרת רק לאחר אישור התשלום. אישור ישלח לאימייל. ספלים שופ פועלת כעוסק פטור מס׳ 321630279. המחירים נקובים בשקלים חדשים ואינם כוללים מע"מ, ובגין כל רכישה תופק קבלה (לא חשבונית מס). התשלום מתבצע באמצעות Tranzila.` },
      { type: "h", text: "⚠️ זכויות יוצרים ותוכן פוגעני" },
      { type: "p", text: "הלקוח מתחייב להעלות רק עיצובים שיש לו זכויות עליהם. אסור להעלות:" },
      { type: "l", items: ["תוכן פוגעני, גזעני, אלים או מיני", "לוגואים/דמויות מוגנים בזכויות יוצרים (דיסני, מארוול, NBA, אנימה וכו')", "תוכן המסית לאלימות או שנאה", "תוכן המפר חוק"] },
      { type: "p", text: "הלקוח אחראי באופן בלעדי על התוכן שמעלה. ספלים שופ שומרת על הזכות לסרב להדפיס תוכן פוגעני ולבטל את ההזמנה." },
      { type: "h", text: "הגבלת אחריות" },
      { type: "p", text: "ספלים שופ אינה אחראית לנזקים עקיפים, שינויי גוון מינוריים בין מסך להדפסה בפועל, או כישלון אספקה כתוצאה מ-Force Majeure." },
      { type: "h", text: "סמכות שיפוט" },
      { type: "p", text: "בכל מחלוקת — הסמכות הבלעדית לבתי המשפט המוסמכים במחוז הדרום (באר שבע)." },
      { type: "p", text: "עודכן לאחרונה: 02.06.2026" },
    ],
    accessibility: [
      { type: "p", text: "ספלים שופ רואה חשיבות רבה במתן שירות שוויוני לכלל הלקוחות ובשיפור השירות לאנשים עם מוגבלות. אנו פועלים להנגיש את האתר כך שיתאפשר שימוש נוח לכל אדם, מתוך אמונה בשוויון הזדמנויות ובהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, תשנ\"ח-1998 ולתקנותיו." },
      { type: "h", text: "רמת ההנגשה והתקן" },
      { type: "p", text: "האתר הונגש בהתאם לתקן הישראלי ת\"י 5568 לנגישות תכנים באינטרנט, המבוסס על הנחיות WCAG 2.1 ברמת AA." },
      { type: "h", text: "התאמות הנגישות שיושמו באתר" },
      { type: "l", items: ["תפריט נגישות במסך — הגדלת טקסט, ניגודיות גבוהה והפחתת אנימציות", "ניווט מקלדת מלא (Tab, Enter, Esc) עם סימון מיקוד (focus) ברור וגלוי", "כיבוד העדפת מערכת ההפעלה להפחתת תנועה (reduced motion)", "תפקידים ותוויות ARIA לתמיכה בקוראי מסך (NVDA, JAWS, VoiceOver)", "טקסט חלופי (alt) לתמונות", "מבנה HTML סמנטי ותוויות (label) לשדות טופס", "ניגודיות צבעים העומדת ברמת AA", "תמיכה מלאה בכיווניות מימין-לשמאל (RTL) ובתצוגה מותאמת למובייל", "תמיכה ב-3 שפות: עברית, אנגלית ורוסית"] },
      { type: "h", text: "מגבלות ידועות" },
      { type: "p", text: "אנו פועלים באופן שוטף לשיפור הנגישות בכל חלקי האתר. ייתכן שחלקים מסוימים, לרבות תכנים או רכיבים של צד שלישי, טרם הונגשו במלואם. אנו מתקנים ליקויים שמתגלים בהקדם האפשרי, ונשמח לקבל דיווח על כל בעיה.", },
      { type: "h", text: "רכז הנגישות ופנייה בנושא" },
      { type: "p", text: "רכז הנגישות: ספלים שופ (גלב). בכל שאלה, בקשה או דיווח על בעיית נגישות ניתן לפנות במייל hello@sfalimshop.com או בטלפון 050-484-7874 (972-50-4847874+). נשתדל להשיב תוך 48 שעות." },
      { type: "p", text: "עודכן לאחרונה: 02.06.2026" },
    ],
  },
  en: {
    refund: [
      { type: "p", text: "This policy follows Israeli Consumer Protection Law 5741-1981 and its regulations." },
      { type: "h", text: "1. General Cancellation Right" },
      { type: "p", text: "Customers may cancel an order within 14 days of receiving the product, provided it has not been used or damaged." },
      { type: "h", text: "2. ⚠️ Personalized Items — No Cancellation Right" },
      { type: "p", text: "Per Regulation 6(b)(1), custom-designed items (Print-on-Demand t-shirts, mugs, stickers, etc.) cannot be cancelled. Once you order a product with your own design, no refund or return is available." },
      { type: "h", text: "3. Refunds in Special Cases" },
      { type: "p", text: "We will refund custom items in these cases:" },
      { type: "l", items: ["Product defect or print quality issue", "Our mistake (wrong size, wrong item)", "Item not arrived within 21 business days"] },
      { type: "p", text: "Contact us within 3 business days of receiving the item with photos of the defect and order number." },
      { type: "h", text: "4. Refund Process" },
      { type: "p", text: "Refund will be processed within 7 business days via the original payment method. Replacement items shipped within 7-14 business days." },
      { type: "h", text: "5. Cancellation Fee" },
      { type: "p", text: "For legal cancellations, the business may charge 5% of the transaction or 100 ILS — whichever is lower." },
      { type: "h", text: "6. Extended Cancellation for Certain Groups" },
      { type: "p", text: "A person with a disability, a senior citizen (65+), or a new immigrant (oleh) may cancel a transaction within up to 4 months of the transaction or receipt of the product (whichever is later), subject to the conditions of the law and presentation of appropriate documentation. The exclusion for personalized/custom items applies in these cases as well." },
      { type: "h", text: "7. Cancellation by Sfalim Shop" },
      { type: "p", text: "We reserve the right to cancel orders and refund payment in cases of stock shortage, pricing errors, suspected fraud, or offensive/copyrighted content." },
      { type: "p", text: "Last updated: June 2, 2026" },
    ],
    shipping: [
      { type: "h", text: "Service Areas" },
      { type: "p", text: "Sfalim Shop ships throughout Israel. International shipping by special arrangement." },
      { type: "h", text: "Delivery Times" },
      { type: "l", items: ["3-10 business days for most destinations", "Up to 14 business days during high demand or special prints", "Delivery time begins from payment confirmation date", "Friday, Saturday, and holidays do not count as business days"] },
      { type: "h", text: "Shipping Fees" },
      { type: "p", text: "30 ILS — flat rate for most areas. Remote areas (Arava, Mt. Hermon, border areas) may incur additional fees by prior arrangement." },
      { type: "h", text: "Self-Pickup" },
      { type: "p", text: "Self-pickup from Be'er Sheva can be arranged — free of charge. Call to coordinate." },
      { type: "h", text: "Shipping Delays" },
      { type: "p", text: "If a package hasn't arrived within 21 business days, please contact us — we'll arrange reshipping or full refund." },
      { type: "p", text: "Last updated: June 2, 2026" },
    ],
    privacy: [
      { type: "h", text: "Information We Collect" },
      { type: "l", items: ["Personal: full name, email, phone, shipping address", "Order data: products, designs, notes", "Technical (automatic): IP, browser type, basic cookies"] },
      { type: "h", text: "Purpose of Collection" },
      { type: "l", items: ["Order fulfillment and delivery", "Customer communication", "Support and inquiries", "Service improvement", "Legal compliance"] },
      { type: "p", text: "Providing your information is voluntary, but without the required details (name, address, contact) we cannot process and ship your order." },
      { type: "h", text: "What We Do NOT Do" },
      { type: "l", items: ["We will not sell your data to third parties", "No spam without explicit consent", "We do not store credit card details (payment via Tranzila — PCI-DSS compliant)"] },
      { type: "h", text: "Data Security" },
      { type: "p", text: "Site is SSL secured (HTTPS). Database hosted on Supabase with encryption. Payment details go directly to Tranzila." },
      { type: "h", text: "PCI DSS Declaration — Credit Card Security" },
      { type: "p", text: "Sfalim Shop declares compliance with credit card industry security requirements and PCI DSS standards:" },
      { type: "l", items: ["The business does NOT store credit card details in any systems or manually", "Our secure payment page provider is Tranzila — certified PCI DSS Level 1, the highest security level in the industry", "Credit card details are sent directly from the customer to Tranzila via an encrypted channel (SSL/TLS)", "We do not see, store, or have access to credit card details at any stage"] },
      { type: "h", text: "Data Storage and Processing Abroad" },
      { type: "p", text: "Some of our services are provided by vendors that store and process data outside Israel: Supabase (database hosting — names, orders, contact details), Vercel (website hosting), and Tranzila (payment processing — an Israeli company; card details are not stored by us). By using the site and providing your details, you consent to your information being transferred to and stored with these providers, including outside Israel. We work only with providers committed to accepted encryption and protection measures, and data is transferred solely to operate the site and fulfill your order." },
      { type: "h", text: "Third-Party Sharing" },
      { type: "p", text: "Information shared only with: shipping company (delivery), Tranzila (payment), and authorities if legally required." },
      { type: "h", text: "Your Rights" },
      { type: "p", text: "You have the right to access, correct, delete, and receive your data. Email hello@sfalimshop.com to request." },
      { type: "p", text: "Last updated: June 2, 2026" },
    ],
    terms: [
      { type: "h", text: "General" },
      { type: "p", text: "Using this site constitutes acceptance of these terms. The business may update the terms at any time." },
      { type: "h", text: "Purchase Eligibility" },
      { type: "p", text: "Minimum age 18 (or with parental approval). Must provide accurate and complete information." },
      { type: "h", text: "Orders and Payment" },
      { type: "p", text: "Orders are confirmed only after payment approval. Confirmation sent by email. Sfalim Shop operates as an Exempt Dealer No. 321630279. Prices are in Israeli Shekels and do not include VAT; a receipt (not a tax invoice) is issued for each purchase. Payment is processed via Tranzila." },
      { type: "h", text: "⚠️ Copyright and Offensive Content" },
      { type: "p", text: "Customer agrees to upload only designs they have rights to. Prohibited content:" },
      { type: "l", items: ["Offensive, racist, violent, or sexual content", "Copyrighted logos/characters (Disney, Marvel, NBA, anime, etc.)", "Content inciting violence or hatred", "Content violating any law"] },
      { type: "p", text: "Customer is solely responsible for uploaded content. Sfalim Shop reserves the right to refuse offensive content and cancel orders." },
      { type: "h", text: "Limitation of Liability" },
      { type: "p", text: "Sfalim Shop is not responsible for indirect damages, minor color variations between screen and actual print, or delivery failures due to Force Majeure." },
      { type: "h", text: "Jurisdiction" },
      { type: "p", text: "Any dispute — exclusive jurisdiction to courts in Southern District (Be'er Sheva), Israel." },
      { type: "p", text: "Last updated: June 2, 2026" },
    ],
    accessibility: [
      { type: "p", text: "Sfalim Shop values equal service for all customers and is committed to making its website usable by everyone, including people with disabilities, in the spirit of equal opportunity and in accordance with Israel's Equal Rights for Persons with Disabilities Law, 5758-1998, and its regulations." },
      { type: "h", text: "Accessibility Level & Standard" },
      { type: "p", text: "This site was made accessible in accordance with Israeli Standard IS 5568 for web content accessibility, which is based on the WCAG 2.1 guidelines at Level AA." },
      { type: "h", text: "Accessibility Measures Implemented" },
      { type: "l", items: ["On-screen accessibility menu — enlarge text, high contrast, and reduce animations", "Full keyboard navigation (Tab, Enter, Esc) with a clearly visible focus indicator", "Respects the operating system's reduced-motion preference", "ARIA roles and labels for screen reader support (NVDA, JAWS, VoiceOver)", "Alt text on images", "Semantic HTML structure and labels for form fields", "Color contrast meeting Level AA", "Full right-to-left (RTL) support and a responsive mobile layout", "3-language support: Hebrew, English, and Russian"] },
      { type: "h", text: "Known Limitations" },
      { type: "p", text: "We continuously work to improve accessibility across the entire site. Some parts, including third-party content or components, may not yet be fully accessible. We fix issues as soon as they are found and welcome reports of any problem." },
      { type: "h", text: "Accessibility Coordinator & Contact" },
      { type: "p", text: "Accessibility coordinator: Sfalim Shop (Gleb). For any question, request, or report of an accessibility problem, contact hello@sfalimshop.com or +972-50-4847874. We aim to respond within 48 hours." },
      { type: "p", text: "Last updated: June 2, 2026" },
    ],
  },
  ru: {
    refund: [
      { type: "p", text: "Настоящая политика составлена в соответствии с Законом Израиля о защите потребителя 5741-1981." },
      { type: "h", text: "1. Право отмены" },
      { type: "p", text: "Клиент имеет право отменить заказ в течение 14 дней с момента получения товара, при условии что товар не использовался и не повреждён." },
      { type: "h", text: "2. ⚠️ Персонализированные товары — без права отмены" },
      { type: "p", text: "Согласно правилу 6(б)(1), персонализированные товары (футболки, кружки, наклейки с индивидуальным дизайном) не подлежат отмене. После заказа товара с вашим дизайном — возврат невозможен." },
      { type: "h", text: "3. Возврат в особых случаях" },
      { type: "p", text: "Мы вернём деньги за персонализированные товары в случаях:" },
      { type: "l", items: ["Дефект товара или качества печати", "Ошибка с нашей стороны (неверный размер, не тот товар)", "Товар не прибыл в течение 21 рабочего дня"] },
      { type: "p", text: "Свяжитесь с нами в течение 3 рабочих дней с момента получения с фото дефекта и номером заказа." },
      { type: "h", text: "4. Процесс возврата" },
      { type: "p", text: "Возврат средств в течение 7 рабочих дней тем же способом оплаты. Замена товара — отправка нового в течение 7-14 рабочих дней." },
      { type: "h", text: "5. Комиссия за отмену" },
      { type: "p", text: "При законной отмене бизнес имеет право взимать 5% от стоимости или 100 шек. — что меньше." },
      { type: "h", text: "6. Продлённое право отмены для отдельных групп" },
      { type: "p", text: "Человек с инвалидностью, пожилой человек (65+) или новый репатриант (оле) может отменить сделку в течение до 4 месяцев со дня сделки или получения товара (что позже), при соблюдении условий закона и предъявлении соответствующего документа. Исключение для персонализированных товаров действует и в этих случаях." },
      { type: "h", text: "7. Отмена со стороны Sfalim Shop" },
      { type: "p", text: "Мы оставляем за собой право отменить заказ и вернуть деньги в случаях отсутствия товара, ошибок в цене, подозрений в мошенничестве или оскорбительного/нарушающего авторские права контента." },
      { type: "p", text: "Последнее обновление: 02.06.2026" },
    ],
    shipping: [
      { type: "h", text: "Зоны доставки" },
      { type: "p", text: "Sfalim Shop доставляет по всему Израилю. Доставка за границу — по спец. договорённости." },
      { type: "h", text: "Сроки доставки" },
      { type: "l", items: ["3-10 рабочих дней для большинства направлений", "До 14 рабочих дней при высокой нагрузке или спец. печати", "Срок начинается с момента подтверждения оплаты", "Пятница, суббота и праздники не считаются рабочими"] },
      { type: "h", text: "Стоимость доставки" },
      { type: "p", text: "30 шек. — единый тариф для большинства зон. Удалённые зоны (Арава, Хермон, приграничные) — возможна доплата по согласованию." },
      { type: "h", text: "Самовывоз" },
      { type: "p", text: "Возможен самовывоз из Беэр-Шевы — бесплатно. Позвоните для согласования." },
      { type: "h", text: "Задержки доставки" },
      { type: "p", text: "Если посылка не пришла в течение 21 рабочего дня — свяжитесь с нами, решим проблему: повторная отправка или полный возврат." },
      { type: "p", text: "Последнее обновление: 02.06.2026" },
    ],
    privacy: [
      { type: "h", text: "Какую информацию собираем" },
      { type: "l", items: ["Личные данные: имя, email, телефон, адрес доставки", "Данные заказа: товары, дизайны, заметки", "Технические (автоматически): IP, тип браузера, базовые cookies"] },
      { type: "h", text: "Цель сбора" },
      { type: "l", items: ["Выполнение заказа и доставка", "Связь с клиентом", "Поддержка и запросы", "Улучшение сервиса", "Соблюдение закона"] },
      { type: "p", text: "Предоставление данных добровольно, но без необходимых данных (имя, адрес, контакты) мы не сможем обработать и отправить ваш заказ." },
      { type: "h", text: "Что мы НЕ делаем" },
      { type: "l", items: ["Не продаём ваши данные третьим лицам", "Не отправляем спам без согласия", "Не храним данные карт (оплата через Tranzila — стандарт PCI-DSS)"] },
      { type: "h", text: "Безопасность данных" },
      { type: "p", text: "Сайт защищён SSL (HTTPS). База данных на Supabase с шифрованием. Платёжные данные идут напрямую в Tranzila." },
      { type: "h", text: "Декларация PCI DSS — безопасность карт" },
      { type: "p", text: "Sfalim Shop заявляет о соответствии требованиям безопасности кредитных карт и стандарту PCI DSS:" },
      { type: "l", items: ["Бизнес НЕ хранит данные кредитных карт в системах или вручную", "Наш поставщик безопасной страницы оплаты — Tranzila, сертифицированный PCI DSS Level 1 (высший уровень безопасности)", "Данные карты передаются напрямую от клиента в Tranzila по зашифрованному каналу (SSL/TLS)", "Мы не видим, не храним и не имеем доступа к данным карт ни на одном этапе"] },
      { type: "h", text: "Хранение и обработка данных за рубежом" },
      { type: "p", text: "Часть услуг сайта предоставляется поставщиками, которые хранят и обрабатывают данные за пределами Израиля: Supabase (хостинг базы данных — имена, заказы, контактные данные), Vercel (хостинг сайта) и Tranzila (обработка платежей — израильская компания; данные карты у нас не хранятся). Используя сайт и предоставляя свои данные, вы соглашаетесь на передачу и хранение вашей информации у этих поставщиков, в том числе за пределами Израиля. Мы работаем только с поставщиками, соблюдающими принятые меры шифрования и защиты; данные передаются исключительно для работы сайта и выполнения заказа." },
      { type: "h", text: "Передача третьим лицам" },
      { type: "p", text: "Данные передаются только: курьерской службе (доставка), Tranzila (оплата) и властям при законном требовании." },
      { type: "h", text: "Ваши права" },
      { type: "p", text: "Вы имеете право на доступ, исправление, удаление и получение ваших данных. Запросы на hello@sfalimshop.com." },
      { type: "p", text: "Последнее обновление: 02.06.2026" },
    ],
    terms: [
      { type: "h", text: "Общие положения" },
      { type: "p", text: "Использование сайта означает согласие с условиями. Бизнес может обновлять условия в любое время." },
      { type: "h", text: "Право на покупку" },
      { type: "p", text: "Минимальный возраст 18 (или с согласия родителя). Обязательное предоставление точных и полных данных." },
      { type: "h", text: "Заказы и оплата" },
      { type: "p", text: "Заказ подтверждается только после одобрения платежа. Подтверждение отправляется на email. Sfalim Shop работает как освобождённый предприниматель № 321630279. Цены указаны в израильских шекелях и не включают НДС; на каждую покупку выдаётся квитанция (не налоговая накладная). Оплата производится через Tranzila." },
      { type: "h", text: "⚠️ Авторские права и недопустимый контент" },
      { type: "p", text: "Клиент обязуется загружать только дизайны с правами. Запрещено:" },
      { type: "l", items: ["Оскорбительный, расистский, агрессивный или сексуальный контент", "Защищённые авторским правом логотипы/персонажи (Disney, Marvel, NBA, аниме и др.)", "Контент, разжигающий насилие или ненависть", "Контент, нарушающий закон"] },
      { type: "p", text: "Клиент несёт исключительную ответственность за загружаемый контент. Sfalim Shop вправе отказать в печати и отменить заказ." },
      { type: "h", text: "Ограничение ответственности" },
      { type: "p", text: "Sfalim Shop не несёт ответственности за косвенный ущерб, незначительные отличия цвета между экраном и печатью, сбои доставки из-за форс-мажора." },
      { type: "h", text: "Подсудность" },
      { type: "p", text: "Любые споры — исключительная подсудность судов Южного округа Израиля (Беэр-Шева)." },
      { type: "p", text: "Последнее обновление: 02.06.2026" },
    ],
    accessibility: [
      { type: "p", text: "Sfalim Shop стремится обеспечить равное обслуживание всем клиентам и сделать сайт удобным для всех, включая людей с ограниченными возможностями, исходя из принципа равных возможностей и в соответствии с Законом Израиля о равных правах для людей с инвалидностью 5758-1998 и его подзаконными актами." },
      { type: "h", text: "Уровень доступности и стандарт" },
      { type: "p", text: "Сайт адаптирован в соответствии с израильским стандартом IS 5568 по доступности веб-контента, основанным на рекомендациях WCAG 2.1 уровня AA." },
      { type: "h", text: "Реализованные меры доступности" },
      { type: "l", items: ["Экранное меню доступности — увеличение текста, высокий контраст и уменьшение анимаций", "Полная навигация с клавиатуры (Tab, Enter, Esc) с чётким видимым индикатором фокуса", "Учитывает системную настройку уменьшения движения (reduced motion)", "Роли и метки ARIA для поддержки скринридеров (NVDA, JAWS, VoiceOver)", "Alt-текст для изображений", "Семантическая HTML-структура и метки (label) для полей форм", "Цветовой контраст уровня AA", "Полная поддержка письма справа налево (RTL) и адаптивная мобильная вёрстка", "Поддержка 3 языков: иврит, английский и русский"] },
      { type: "h", text: "Известные ограничения" },
      { type: "p", text: "Мы постоянно работаем над улучшением доступности на всём сайте. Некоторые части, включая контент или компоненты сторонних поставщиков, могут быть пока адаптированы не полностью. Мы устраняем выявленные недостатки в кратчайшие сроки и будем рады сообщениям о любых проблемах." },
      { type: "h", text: "Координатор по доступности и обратная связь" },
      { type: "p", text: "Координатор по доступности: Sfalim Shop (Глеб). По любым вопросам, просьбам или сообщениям о проблеме доступности обращайтесь: hello@sfalimshop.com или +972-50-4847874. Мы постараемся ответить в течение 48 часов." },
      { type: "p", text: "Последнее обновление: 02.06.2026" },
    ],
  },
};

// Localization helpers - translate a saved product/variant name to target language
const PRODUCT_IDS = ['tshirt', 'oversized', 'stonewash', 'dryfit', 'mug', 'sticker', 'sticker_sq'];
const localizeProduct = (savedName, targetLang) => {
  if (!savedName) return savedName;
  for (const id of PRODUCT_IDS) {
    for (const lng of ['he', 'en', 'ru']) {
      if (LANGS[lng]?.products?.[id] === savedName) {
        return LANGS[targetLang]?.products?.[id] || savedName;
      }
    }
  }
  return savedName;
};

const VARIANT_IDS = ['standard', 'large', 'magic', 'small', 'medium', 'largeS', 'sheet'];
const localizeVariant = (savedLabel, targetLang) => {
  if (!savedLabel) return savedLabel;
  // T-shirt sizes (S, M, L, XL, XXL) are universal across languages
  if (['S', 'M', 'L', 'XL', 'XXL'].includes(savedLabel)) return savedLabel;
  for (const id of VARIANT_IDS) {
    for (const lng of ['he', 'en', 'ru']) {
      if (LANGS[lng]?.variants?.[id] === savedLabel) {
        return LANGS[targetLang]?.variants?.[id] || savedLabel;
      }
    }
  }
  return savedLabel;
};

const SHIRT_COLOR_PALETTE = BLOOM_SHIRT_COLORS.map(c => c.hex);

const PRODUCTS = (t) => [
  { id: "mug",        name: t.products.mug,       desc: { he: "ספל פורצלן 11oz · הדפסת סובלימציה · עמיד במדיח", en: "11oz porcelain mug · sublimation print · dishwasher-safe", ru: "Фарфоровая кружка 11oz · сублимационная печать · можно в посудомойке" }, is_bestseller: true, variants: [{ id: "standard", label: t.variants.standard, price: 69 }], colors: ["#ffffff"], printArea: { x: 40, y: 40, w: 260, h: 300 } },
  { id: "tshirt",     name: t.products.tshirt,    desc: { he: "100% כותנה סרוקה · גזרה רגילה · הדפסת DTF", en: "100% combed cotton · regular fit · DTF print", ru: "100% хлопок · обычный крой · DTF-печать" }, is_bestseller: true, variants: [{ id: "s", label: "S", price: 89 }, { id: "m", label: "M", price: 89 }, { id: "l", label: "L", price: 89 }, { id: "xl", label: "XL", price: 99 }, { id: "xxl", label: "XXL", price: 99 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "oversized",  name: t.products.oversized, desc: { he: "100% כותנה סרוקה · אוברסייז", en: "100% combed cotton · oversize", ru: "100% чёсаный хлопок · оверсайз" }, is_new: true, variants: [{ id: "s", label: "S", price: 119 }, { id: "m", label: "M", price: 119 }, { id: "l", label: "L", price: 119 }, { id: "xl", label: "XL", price: 119 }, { id: "xxl", label: "XXL", price: 119 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "stonewash",  name: t.products.stonewash, desc: { he: "100% כותנה סרוקה · אוברסייז, גימור וינטג' סטון-ווש", en: "100% combed cotton · oversize, vintage stone-wash finish", ru: "100% чёсаный хлопок · оверсайз, винтажная отделка стоунвош" }, is_new: true, variants: [{ id: "s", label: "S", price: 119 }, { id: "m", label: "M", price: 119 }, { id: "l", label: "L", price: 119 }, { id: "xl", label: "XL", price: 119 }, { id: "xxl", label: "XXL", price: 119 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "dryfit",     name: t.products.dryfit,    desc: { he: "פוליאסטר נושם · מתאים לאימון · הדפסת סובלימציה", en: "Breathable polyester · sport-ready · sublimation print", ru: "Дышащий полиэстер · для спорта · сублимационная печать" }, variants: [{ id: "s", label: "S", price: 95 }, { id: "m", label: "M", price: 95 }, { id: "l", label: "L", price: 95 }, { id: "xl", label: "XL", price: 105 }, { id: "xxl", label: "XXL", price: 105 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "sticker",    name: t.products.sticker,   desc: { he: "מדבקת ויניל עגולה · עמידה במים ובשמש", en: "Round vinyl sticker · water- and UV-resistant", ru: "Круглый виниловый стикер · водо- и UV-устойчивый" }, variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8", "#eff6ff", "#fff7ed", "#fef2f2", "#f0fdfa"], printArea: { x: 20, y: 20, w: 360, h: 360 } },
  { id: "sticker_sq", name: t.products.sticker_sq, desc: { he: "מדבקת ויניל מרובעת · עמידה במים ובשמש", en: "Square vinyl sticker · water- and UV-resistant", ru: "Квадратный виниловый стикер · водо- и UV-устойчивый" }, is_new: true, variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8", "#eff6ff", "#fff7ed", "#fef2f2", "#f0fdfa"], printArea: { x: 20, y: 20, w: 360, h: 360 } },
];

// Customer-facing slice of PRODUCTS for the order wizard and Hero showcase.
// Honors the CUSTOM_STICKERS_ENABLED flag — when false, both sticker IDs are
// filtered out at the DISPLAY layer only. The full PRODUCTS array is left
// untouched so internal lookups by id (BLOOM sticker orders, admin history
// re-renders, localizeProduct) keep functioning.
const CUSTOM_STICKER_IDS = ['sticker', 'sticker_sq'];
const getCustomProducts = (t) => {
  let all = PRODUCTS(t);
  if (!STONEWASH_ENABLED) all = all.filter(p => p.id !== `stonewash`);
  if (CUSTOM_STICKERS_ENABLED) return all;
  return all.filter(p => !CUSTOM_STICKER_IDS.includes(p.id));
};

// Format a price range for product cards: "₪89" if min===max, otherwise "₪89–₪99".
// The range is wrapped in Unicode LTR isolates (U+2066 … U+2069) so that inside
// the Hebrew (RTL) layout the "₪89–₪99" run stays low→high left-to-right and the
// en-dash isn't flipped to read "₪99–₪89". Single value needs no isolation.
const formatPriceRange = (variants) => {
  const prices = variants.map(v => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `₪${min}` : `⁦₪${min}–₪${max}⁩`;
};

// Placement presets — cx/cy = center of the design on the mockup (SVG units, 400×400)
const PLACEMENTS = {
  tshirt:  [
    { id: "left_chest",   he: "חזה שמאל",  en: "Left Chest", ru: "Левый карман", cx: 238, cy: 145, smallOnly: true },
    { id: "center_chest", he: "מרכז",       en: "Center",     ru: "Центр",        cx: 200, cy: 165 },
    { id: "bottom",       he: "למטה",       en: "Bottom",     ru: "Низ",          cx: 200, cy: 270 },
  ],
  oversized: [
    { id: "left_chest",   he: "חזה שמאל",  en: "Left Chest", ru: "Левый карман", cx: 242, cy: 145, smallOnly: true },
    { id: "center_chest", he: "מרכז",       en: "Center",     ru: "Центр",        cx: 200, cy: 165 },
    { id: "bottom",       he: "למטה",       en: "Bottom",     ru: "Низ",          cx: 200, cy: 280 },
  ],
  stonewash: [
    { id: "left_chest",   he: "חזה שמאל",  en: "Left Chest", ru: "Левый карман", cx: 242, cy: 145, smallOnly: true },
    { id: "center_chest", he: "מרכז",       en: "Center",     ru: "Центр",        cx: 200, cy: 165 },
    { id: "bottom",       he: "למטה",       en: "Bottom",     ru: "Низ",          cx: 200, cy: 280 },
  ],
  dryfit: [
    { id: "left_chest",   he: "חזה שמאל",  en: "Left Chest", ru: "Левый карман", cx: 238, cy: 145, smallOnly: true },
    { id: "center_chest", he: "מרכז",       en: "Center",     ru: "Центр",        cx: 200, cy: 165 },
    { id: "bottom",       he: "למטה",       en: "Bottom",     ru: "Низ",          cx: 200, cy: 275 },
  ],
  mug: [
    { id: "left",   he: "שמאל",  en: "Left",   ru: "Слева",  cx: 120, cy: 178 },
    { id: "center", he: "מרכז",  en: "Center", ru: "Центр",  cx: 158, cy: 178 },
    { id: "right",  he: "ימין",  en: "Right",  ru: "Справа", cx: 193, cy: 178 },
  ],
  sticker: [
    { id: "center", he: "מרכז",  en: "Center", ru: "Центр", cx: 200, cy: 198 },
    { id: "top",    he: "עליון", en: "Top",    ru: "Верх",  cx: 200, cy: 135 },
    { id: "bottom", he: "תחתון", en: "Bottom", ru: "Низ",   cx: 200, cy: 265 },
  ],
  sticker_sq: [
    { id: "center", he: "מרכז",  en: "Center", ru: "Центр", cx: 200, cy: 198 },
    { id: "top",    he: "עליון", en: "Top",    ru: "Верх",  cx: 200, cy: 135 },
    { id: "bottom", he: "תחתון", en: "Bottom", ru: "Низ",   cx: 200, cy: 265 },
  ],
};

// Print size options — px = SVG units, cm = displayed label
const SIZE_OPTIONS = {
  tshirt:  [
    { id: "small",  px: 55,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "10×10 cm" },
    { id: "medium", px: 85,  label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "20×20 cm" },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "30×30 cm" },
  ],
  oversized: [
    { id: "small",  px: 55,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "10×10 cm" },
    { id: "medium", px: 85,  label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "20×20 cm" },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "30×30 cm" },
  ],
  stonewash: [
    { id: "small",  px: 55,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "10×10 cm" },
    { id: "medium", px: 85,  label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "20×20 cm" },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "30×30 cm" },
  ],
  dryfit: [
    { id: "small",  px: 55,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "10×10 cm" },
    { id: "medium", px: 85,  label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "20×20 cm" },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "30×30 cm" },
  ],
  mug: [
    { id: "small",  px: 40,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "5×5 cm"   },
    { id: "medium", px: 65,  label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "8×8 cm"   },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "12×10 cm" },
  ],
  sticker: [
    { id: "small",  px: 60,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "5×5 cm"   },
    { id: "medium", px: 110, label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "8×8 cm"   },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "10×10 cm" },
  ],
  sticker_sq: [
    { id: "small",  px: 60,  label: { he: "קטן",   en: "Small",  ru: "Мал." },  cm: "5×5 cm"   },
    { id: "medium", px: 110, label: { he: "בינוני", en: "Medium", ru: "Сред." }, cm: "8×8 cm"   },
    { id: "large",  px: 160, label: { he: "גדול",  en: "Large",  ru: "Бол." },  cm: "10×10 cm" },
  ],
};

// Supabase mockup image URLs
// 1. הגדרת קישורים דינמיים לפי צבעים מתוך ה-Supabase שלכם
const MOCKUP_URLS = {
  tshirt:     "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/t%20shirt%20basic%20.png",
  oversized:  "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/oversize.png",
  // Stone-wash reuses the Oversize mockup for now (owner will replace later).
  stonewash:  "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/oversize.png",
  dryfit:     "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/dri%20fit%20t%20shirt.png",
  mug:        "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/mug.png",
  sticker:    "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/round%20sticker.png",
  sticker_sq: "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/square%20sticker.png",
};

// transformImage — rewrites a Supabase Storage *public object* URL to the
// on-the-fly image-transform endpoint (Pro feature), serving a resized,
// re-compressed image for thumbnail/card/grid contexts. Browsers send
// Accept: image/webp so Supabase returns webp regardless of source format,
// cutting payloads ~50–85%. Use ONLY for small display sizes; the PetModal
// large preview keeps the original full-res URL. Any non-Supabase or
// already-transformed URL passes through untouched. Pass `width` at ~2× the
// displayed CSS width so retina screens stay sharp.
// resize=contain is REQUIRED: Supabase defaults to resize=cover, which with a
// width-only request crops the source (it cropped the 1414×2000 BLOOM portraits
// to narrow center strips). `contain` preserves the source aspect ratio — no
// cropping — so the framed designs render in full.
const transformImage = (url, { width, quality = 75 } = {}) => {
  if (typeof url !== `string` || !url.includes(`/storage/v1/object/public/`)) return url;
  const base = url.replace(`/storage/v1/object/public/`, `/storage/v1/render/image/public/`);
  const sep = base.includes(`?`) ? `&` : `?`;
  return `${base}${sep}width=${width}&quality=${quality}&resize=contain`;
};

// SmartImage — drop-in replacement for <img> on product images served from
// Supabase Storage. The first cold-cache fetch occasionally fails and shows
// a broken-image glyph until the user refreshes. SmartImage retries up to
// 3 times with a 500ms back-off, appending ?retry=N as a cache-buster on
// each retry, and paints a gray placeholder background until the image
// successfully loads. The cache-buster is only applied to http(s) URLs so
// that data:/blob:/relative URLs are left untouched. If all retries fail,
// renders a plain placeholder div instead of an <img> so the browser never
// paints the broken-image glyph.
function SmartImage({ src, alt, style, onError, onLoad, ...rest }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef(null);
  const imgRef = useRef(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setFailed(false);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [src]);

  // A cached image can already be `complete` before React attaches onLoad — in
  // that case the load event never fires and the <img> would stay at opacity:0
  // (invisible). This happens e.g. opening the BLOOM modal after the same
  // portrait was shown in the /pets grid. Detect it and reveal the image.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  });

  const isRemote = typeof src === "string" && /^https?:/i.test(src);
  const finalSrc = !src
    ? src
    : (attempt === 0 || !isRemote)
      ? src
      : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  const handleError = (e) => {
    if (attempt < MAX_RETRIES) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
    } else {
      setFailed(true);
    }
    if (onError) onError(e);
  };

  const handleLoad = (e) => {
    setLoaded(true);
    if (onLoad) onLoad(e);
  };

  const placeholderStyle = {
    ...style,
    backgroundColor: loaded ? (style && style.backgroundColor) : "#222",
  };
  // Fade the <img> in once it actually loads — the gray #222 placeholder
  // background stays visible underneath until the bitmap is ready, so the
  // character image materialises softly instead of popping.
  const imgStyle = {
    ...placeholderStyle,
    opacity: loaded ? 1 : 0,
    transition: `opacity 0.5s ease`,
  };

  if (failed) {
    return <div {...rest} role="img" aria-label={alt} style={placeholderStyle} />;
  }

  return (
    <img
      {...rest}
      ref={imgRef}
      src={finalSrc}
      alt={alt}
      style={imgStyle}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

// 2. קומפוננטת הבסיס המתוקנת - נקייה ובלי פילטרים ששוברים את הרקע
function ProductMockupBase({ productKey, color, imageUrl, imagePos, secondImageUrl, secondImagePos }) {
  const canvasRef = useRef(null);
  const [canvasOk, setCanvasOk] = useState(false);
  const mockupUrl = MOCKUP_URLS[productKey] || MOCKUP_URLS.tshirt;

  useEffect(() => {
    setCanvasOk(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 600;
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    const draw = (img) => {
      ctx.clearRect(0, 0, size, size);
      if (!color || color === '#ffffff') {
        ctx.drawImage(img, 0, 0, size, size);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, 0, 0, size, size);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img, 0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';
      }
      setCanvasOk(true);
    };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => draw(img);
    img.onerror = () => setCanvasOk(false);
    img.src = mockupUrl;
  }, [mockupUrl, color]);

  return (
    <div style={{ position:"relative", width:"100%", paddingTop:"100%", borderRadius:12 }}>
      <SmartImage src={mockupUrl} alt="product" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", zIndex:0, opacity: canvasOk ? 0 : 1, transition:"opacity 0.2s" }} />
      <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:1, opacity: canvasOk ? 1 : 0, transition:"opacity 0.2s" }} />
      {imageUrl && (
        <img src={imageUrl} alt="design" style={{ position:"absolute", left:`${(imagePos.x/400)*100}%`, top:`${(imagePos.y/400)*100}%`, width:`${(imagePos.size/400)*100}%`, height:`${(imagePos.size/400)*100}%`, objectFit:"contain", zIndex:2, pointerEvents:"none" }} />
      )}
      {secondImageUrl && secondImagePos && (
        <img src={secondImageUrl} alt="design2" style={{ position:"absolute", left:`${(secondImagePos.x/400)*100}%`, top:`${(secondImagePos.y/400)*100}%`, width:`${(secondImagePos.size/400)*100}%`, height:`${(secondImagePos.size/400)*100}%`, objectFit:"contain", zIndex:3, pointerEvents:"none" }} />
      )}
    </div>
  );
}

function TShirtMockup({ color, imageUrl, imagePos, secondImageUrl, secondImagePos }) {
  return <ProductMockupBase productKey="tshirt" color={color} imageUrl={imageUrl} imagePos={imagePos} secondImageUrl={secondImageUrl} secondImagePos={secondImagePos} />;
}
function OversizedMockup({ color, imageUrl, imagePos, secondImageUrl, secondImagePos }) {
  return <ProductMockupBase productKey="oversized" color={color} imageUrl={imageUrl} imagePos={imagePos} secondImageUrl={secondImageUrl} secondImagePos={secondImagePos} />;
}
function DryfitMockup({ color, imageUrl, imagePos, secondImageUrl, secondImagePos }) {
  return <ProductMockupBase productKey="dryfit" color={color} imageUrl={imageUrl} imagePos={imagePos} secondImageUrl={secondImageUrl} secondImagePos={secondImagePos} />;
}
function MugMockup({ color, imageUrl, imagePos }) {
  return <ProductMockupBase productKey="mug" color={color} imageUrl={imageUrl} imagePos={imagePos} />;
}
function StickerMockup({ color, imageUrl, imagePos }) {
  return <ProductMockupBase productKey="sticker" color={color} imageUrl={imageUrl} imagePos={imagePos} />;
}
function StickerSqMockup({ color, imageUrl, imagePos }) {
  return <ProductMockupBase productKey="sticker_sq" color={color} imageUrl={imageUrl} imagePos={imagePos} />;
}

// ── Order mockup generation ──────────────────────────────────────────────────
// Flatten the product (in the chosen colour) + the design overlay(s) onto one
// offscreen canvas and export a PNG — exactly what ProductMockupBase renders
// live. Used at checkout to snapshot every order into orders.mockup_url.
const loadImageEl = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Image load failed: ${String(src).slice(0, 80)}`));
  img.src = src;
});

// Draw an image "contained" (aspect ratio preserved, centred) inside a box —
// matches the design overlay's objectFit:"contain" in ProductMockupBase.
const drawContain = (ctx, img, bx, by, bw, bh) => {
  const ar = (img.naturalWidth || img.width || 1) / (img.naturalHeight || img.height || 1);
  let w = bw;
  let h = bw / ar;
  if (h > bh) { h = bh; w = bh * ar; }
  ctx.drawImage(img, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
};

const generateOrderMockup = async (productKey, color, designUrl, imagePos, secondUrl, secondPos) => {
  const size = 600;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Product, tinted to the chosen colour — same logic as ProductMockupBase.
  const mockupUrl = MOCKUP_URLS[productKey] || MOCKUP_URLS.tshirt;
  const productImg = await loadImageEl(mockupUrl);
  if (!color || color === "#ffffff") {
    ctx.drawImage(productImg, 0, 0, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(productImg, 0, 0, size, size);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(productImg, 0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }

  // Design overlay(s). imagePos lives in a 0-400 space; the canvas is 600.
  const scale = size / 400;
  if (designUrl && imagePos) {
    const d = await loadImageEl(designUrl);
    drawContain(ctx, d, imagePos.x * scale, imagePos.y * scale, imagePos.size * scale, imagePos.size * scale);
  }
  if (secondUrl && secondPos) {
    const d2 = await loadImageEl(secondUrl);
    drawContain(ctx, d2, secondPos.x * scale, secondPos.y * scale, secondPos.size * scale, secondPos.size * scale);
  }

  return canvas.toDataURL("image/png");
};
// Auth Page
function AuthPage({ lang, onAuth }) {
  const t = LANGS[lang];
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    let pw = "";
    for (let i = 0; i < 16; i++) {
      pw += chars[arr[i] % chars.length];
    }
    setPassword(pw);
    setShowPassword(true);
    setCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("Copy failed:", err); }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        onAuth(data.user);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#reset-password`,
        });
        if (error) throw error;
        setSuccess(t.auth.forgotPwSent);
      }
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleMagicLink = async () => {
    if (!email) { setError(t.auth.emailRequired); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setSuccess(t.auth.magicLinkSent);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) { setError(err.message); setLoading(false); }
  };

  const inputStyle = { width: "100%", background: "#111", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none", marginTop: 8 };
  const labelStyle = { color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" };
  const smallBtnStyle = { background: "transparent", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 };

  // Forgot Password mode
  if (mode === "forgot") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir }}>
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 40, width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28 }}>{t.auth.forgotPwTitle}</h2>
            <p style={{ color: COLORS.gray, fontSize: 13, marginTop: 8, fontFamily: "'Varela Round',sans-serif" }}>{t.auth.forgotPwDesc}</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-forgot-email" style={labelStyle}>{t.auth.email}</label>
              <input id="auth-forgot-email" type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div role="alert" style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
            {success && <div role="status" style={{ color: COLORS.success, fontSize: 13, marginBottom: 16, background: "rgba(74,222,128,0.1)", padding: "10px 14px", borderRadius: 8 }}>{success}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
              {loading ? "..." : t.auth.forgotPwBtn}
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={smallBtnStyle}>{t.auth.backToLogin}</button>
          </div>
        </div>
      </div>
    );
  }

  // Login / Register mode
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir }}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 40, width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", padding: "4px 16px", borderBottom: "2px solid rgba(255,107,53,0.5)", color: COLORS.accent, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 22, marginBottom: 16 }}>Sfalim</div>
          <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, marginTop: 8 }}>{mode === "login" ? t.auth.loginTitle : t.auth.registerTitle}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="auth-name" style={labelStyle}>{t.auth.name}</label>
              <input id="auth-name" type="text" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="auth-email" style={labelStyle}>{t.auth.email}</label>
            <input id="auth-email" type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="auth-password" style={labelStyle}>{t.auth.password}</label>
              {mode === "login" && (
                <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={smallBtnStyle}>{t.auth.forgotPw}</button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ ...inputStyle, paddingBlock: 12, paddingInlineStart: 14, paddingInlineEnd: 80 }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", insetInlineEnd: 8, top: 14, ...smallBtnStyle, color: COLORS.gray }}>
                {showPassword ? t.auth.hidePw : t.auth.showPw}
              </button>
            </div>
            {mode === "register" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={generatePassword} style={{ flex: 1, background: "rgba(255,107,53,0.1)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {t.auth.generatePw}
                </button>
                {password && (
                  <button type="button" onClick={copyPassword} style={{ background: copied ? COLORS.success : "transparent", border: `1px solid ${copied ? COLORS.success : COLORS.border}`, color: copied ? "#000" : COLORS.gray, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 600, transition: "all 0.2s" }}>
                    {copied ? t.auth.copied : t.auth.copyPw}
                  </button>
                )}
              </div>
            )}
          </div>
          {error && <div role="alert" style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
          {success && <div role="status" style={{ color: COLORS.success, fontSize: 13, marginBottom: 16, background: "rgba(74,222,128,0.1)", padding: "10px 14px", borderRadius: 8 }}>{success}</div>}
          <button type="submit" disabled={loading} style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
            {loading ? "..." : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
          </button>
        </form>

        {/* Magic Link divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          <div style={{ color: COLORS.gray, fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>{t.auth.orDivider}</div>
          <div style={{ flex: 1, height: 1, background: COLORS.border }} />
        </div>
        <button type="button" onClick={handleMagicLink} disabled={loading} style={{ width: "100%", background: "transparent", color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}
          onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent}
          onMouseOut={e => e.currentTarget.style.borderColor = COLORS.border}
        >
          {t.auth.magicLink}
        </button>
        <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", marginTop: 8, fontFamily: "'Varela Round',sans-serif" }}>{t.auth.magicLinkDesc}</p>

        {/* Google login button */}
        <button type="button" onClick={handleGoogleLogin} disabled={loading} style={{ width: "100%", marginTop: 12, background: "#fff", color: "#1a1a1a", border: "1px solid #fff", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          onMouseOver={e => e.currentTarget.style.background = "#f0f0f0"}
          onMouseOut={e => e.currentTarget.style.background = "#fff"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t.auth.googleBtn}
        </button>

        <div style={{ textAlign: "center", marginTop: 20, color: COLORS.gray, fontSize: 13, fontFamily: "'Varela Round',sans-serif" }}>
          {mode === "login" ? t.auth.noAccount : t.auth.hasAccount}{" "}
          <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); setPassword(""); }} style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? t.auth.register : t.auth.login}
          </span>
        </div>
      </div>
    </div>
  );
}

// Reset Password Page (shown when user clicks reset link in email)
function ResetPasswordPage({ lang, setPage }) {
  const t = LANGS[lang];
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    let pw = "";
    for (let i = 0; i < 16; i++) { pw += chars[arr[i] % chars.length]; }
    setPassword(pw); setConfirm(pw); setShowPassword(true); setCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    if (password !== confirm) { setError(t.auth.pwMismatch); return; }
    if (password.length < 8) { setError(t.auth.pwTooShort); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => setPage("track"), 2000);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const inputStyle = { width: "100%", background: "#111", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none", marginTop: 8 };
  const labelStyle = { color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir }}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 40, width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", padding: "4px 16px", borderBottom: "2px solid rgba(255,107,53,0.5)", color: COLORS.accent, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 22, marginBottom: 16 }}>Sfalim</div>
          <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, marginTop: 8 }}>{t.auth.resetPwTitle}</h2>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(40,200,120,0.15)", border: "2px solid #28C878", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#28C878", fontSize: 28, fontWeight: 700 }}>✓</div>
            <div style={{ color: COLORS.success, fontSize: 16, fontWeight: 600, fontFamily: "'Varela Round',sans-serif" }}>{t.auth.pwSet}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reset-new-password" style={labelStyle}>{t.auth.newPw}</label>
              <div style={{ position: "relative" }}>
                <input id="reset-new-password" type={showPassword ? "text" : "password"} name="new-password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ ...inputStyle, paddingBlock: 12, paddingInlineStart: 14, paddingInlineEnd: 80 }} />
                <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", insetInlineEnd: 8, top: 14, background: "transparent", border: "none", color: COLORS.gray, cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>
                  {showPassword ? t.auth.hidePw : t.auth.showPw}
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" onClick={generatePassword} style={{ flex: 1, background: "rgba(255,107,53,0.1)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {t.auth.generatePw}
                </button>
                {password && (
                  <button type="button" onClick={copyPassword} style={{ background: copied ? COLORS.success : "transparent", border: `1px solid ${copied ? COLORS.success : COLORS.border}`, color: copied ? "#000" : COLORS.gray, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                    {copied ? t.auth.copied : t.auth.copyPw}
                  </button>
                )}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="reset-confirm-password" style={labelStyle}>{t.auth.confirmPw}</label>
              <input id="reset-confirm-password" type={showPassword ? "text" : "password"} name="confirm-password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div role="alert" style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading || !password} style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
              {loading ? "..." : t.auth.setPw}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Account Settings — used in TrackPage personal area for setting/changing password
function AccountSettings({ lang }) {
  const t = LANGS[lang];
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    let pw = "";
    for (let i = 0; i < 16; i++) { pw += chars[arr[i] % chars.length]; }
    setPassword(pw); setConfirm(pw); setShowPassword(true); setCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(""); setDone(false);
    if (password !== confirm) { setError(t.auth.pwMismatch); return; }
    if (password.length < 8) { setError(t.auth.pwTooShort); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword(""); setConfirm("");
      setTimeout(() => { setDone(false); setOpen(false); }, 3000);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const inputStyle = { width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 13, outline: "none" };
  const labelStyle = { color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", display: "block", marginBottom: 6 };

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14 }}>{t.auth.accountSettings}</div>
          <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 2 }}>{t.auth.setPasswordDesc}</div>
        </div>
        <span style={{ color: COLORS.gray, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${COLORS.border}` }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
              <div style={{ color: COLORS.success, fontSize: 14, fontWeight: 600 }}>{t.auth.pwSet}</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="account-new-password" style={labelStyle}>{t.auth.newPw}</label>
                <div style={{ position: "relative" }}>
                  <input id="account-new-password" type={showPassword ? "text" : "password"} name="new-password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ ...inputStyle, paddingBlock: 10, paddingInlineStart: 12, paddingInlineEnd: 70 }} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", insetInlineEnd: 8, top: 11, background: "transparent", border: "none", color: COLORS.gray, cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>
                    {showPassword ? t.auth.hidePw : t.auth.showPw}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button type="button" onClick={generatePassword} style={{ flex: 1, background: "rgba(255,107,53,0.1)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: 6, padding: "6px", cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                    {t.auth.generatePw}
                  </button>
                  {password && (
                    <button type="button" onClick={copyPassword} style={{ background: copied ? COLORS.success : "transparent", border: `1px solid ${copied ? COLORS.success : COLORS.border}`, color: copied ? "#000" : COLORS.gray, borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                      {copied ? t.auth.copied : t.auth.copyPw}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="account-confirm-password" style={labelStyle}>{t.auth.confirmPw}</label>
                <input id="account-confirm-password" type={showPassword ? "text" : "password"} name="confirm-password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
              </div>
              {error && <div role="alert" style={{ color: "#f87171", fontSize: 12, marginBottom: 12, background: "rgba(248,113,113,0.1)", padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
              <button type="submit" disabled={loading || !password} style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
                {loading ? "..." : t.auth.setPw}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// Order Tracker
function TrackPage({ lang, user, clearCart }) {
  const t = LANGS[lang];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [msgDrafts, setMsgDrafts] = useState({});
  const [savingMsg, setSavingMsg] = useState({});
  const [guestEmail, setGuestEmail] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [guestSent, setGuestSent] = useState(false);
  // Design-approval flow (custom uploads): pay-now redirect, resubmit panel,
  // and the shared "payments coming soon" modal (reused while Tranzila is off).
  const [paySoon, setPaySoon] = useState(false);
  const [payBusy, setPayBusy] = useState(null);       // order id currently paying
  const [actionBusy, setActionBusy] = useState(null); // order id currently resubmitting/cancelling
  const [actionError, setActionError] = useState(""); // friendly inline error for pay/resubmit/cancel
  const [resubmitOpenId, setResubmitOpenId] = useState(null);
  const [resubmitFile, setResubmitFile] = useState(null); // { dataUrl, name } | null
  // A11y: focus-trap + restore for the "payments coming soon" modal.
  const paySoonRef = useDialogFocus(paySoon);

  // Payment-return handler for create-payment's success redirect
  // (#track?order_group=<id>&paid=1). UI-ONLY: the Tranzila webhook owns
  // payment_status — we only READ it back and reflect succeeded/processing,
  // never set it. Safe if visited directly (no order_group → friendly fallback).
  const [payReturn] = useState(() => {
    if (typeof window === `undefined`) return null;
    const h = rawHash();
    const qi = h.indexOf(`?`);
    if (qi === -1) return null;
    const p = new URLSearchParams(h.slice(qi + 1));
    if (p.get(`paid`) !== `1`) return null;
    return { orderGroup: p.get(`order_group`) || null };
  });
  const [payReturnDismissed, setPayReturnDismissed] = useState(false);
  const [payReturnStatus, setPayReturnStatus] = useState(`loading`); // loading | succeeded | processing | unknown
  useEffect(() => {
    if (!payReturn) return;
    if (!payReturn.orderGroup) { setPayReturnStatus(`unknown`); return; }
    let cancelled = false;
    supabase.from(`orders`).select(`payment_status, status`).eq(`order_group`, payReturn.orderGroup)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) { setPayReturnStatus(`unknown`); return; }
        // Success is gated STRICTLY on payment_status === 'succeeded' (the value
        // the Tranzila webhook writes on a confirmed charge). Never infer success
        // from order status alone.
        const succeeded = data.some(o => o.payment_status === `succeeded`);
        setPayReturnStatus(succeeded ? `succeeded` : `processing`);
        // Clear the cart ONLY on a confirmed-succeeded payment return — never on
        // a failure or an unconfirmed/processing return. Guarded by `succeeded`
        // above so we can't wipe a cart that wasn't actually paid for.
        if (succeeded && typeof clearCart === `function`) clearCart();
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    // Match the customer's account orders AND any placed as a guest with the same email.
    const orFilter = user.email
      ? `user_id.eq.${user.id},customer_email.eq.${user.email}`
      : `user_id.eq.${user.id}`;
    supabase.from("orders").select("*").or(orFilter).order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(data || []);
        const drafts = {};
        (data || []).forEach(o => { drafts[o.id] = o.customer_message || ""; });
        setMsgDrafts(drafts);
        setLoading(false);
      });
  }, [user]);

  const saveCustomerMessage = async (orderId) => {
    setSavingMsg(s => ({ ...s, [orderId]: true }));
    const msg = msgDrafts[orderId] || "";
    const now = new Date().toISOString();
    await supabase.from("orders").update({ customer_message: msg, customer_message_at: now }).eq("id", orderId);
    setOrders(os => os.map(o => o.id === orderId ? { ...o, customer_message: msg, customer_message_at: now } : o));
    setSavingMsg(s => ({ ...s, [orderId]: false }));
  };

  const canEditMessage = (status) => status === "received" || status === "design";

  const getStageIndex = (status) => ORDER_STAGES.findIndex(s => s.key === status);

  // Guest order tracking — email a one-tap magic link, then land back here logged in.
  const sendTrackLink = async () => {
    const email = guestEmail.trim();
    if (!email) return;
    setGuestError(""); setGuestLoading(true);
    try {
      localStorage.setItem("sxp_track_after_login", "1");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setGuestSent(true);
    } catch (err) {
      localStorage.removeItem("sxp_track_after_login");
      setGuestError(err.message);
    }
    setGuestLoading(false);
  };

  // ── Design-approval customer actions ──────────────────────────────────────
  // Pay for an approved order. Mirrors the checkout pay flow: when PAYMENTS_ENABLED
  // is off (no Tranzila supplier yet) we show the same "coming soon" modal; the
  // edge function returns 503 payments_disabled, which we also route to that modal.
  // The charge amount is recomputed server-side from orders.total — we never send it.
  const payForApprovedOrder = async (order) => {
    if (!PAYMENTS_ENABLED) { setPaySoon(true); return; }
    setPayBusy(order.id);
    try {
      const { data, error } = await supabase.functions.invoke(`create-payment`, {
        body: {
          order_group: order.order_group || order.id,
          currency: `ILS`,
          customer: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone },
        },
      });
      if (error) {
        const code = String(error.message || ``).toLowerCase();
        if (code.includes(`payments_disabled`) || code.includes(`503`)) { setPayBusy(null); setPaySoon(true); return; }
        throw error;
      }
      if (data && data.redirect_url) { window.location.href = data.redirect_url; return; }
      throw new Error(`No redirect_url returned from create-payment`);
    } catch (e) {
      console.error(`[pay] create-payment failed:`, e);
      setPayBusy(null);
      setActionError(uiPaymentError(lang));
    }
  };

  // Read a chosen file to a data URL for the optional design replacement.
  const onResubmitFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setResubmitFile({ dataUrl: reader.result, name: file.name });
    reader.readAsDataURL(file);
  };

  // Resubmit a rejected design: optionally upload a new image, then flip the
  // status back to 'pending'. The DB only permits rejected -> pending for the
  // customer, so this is the single allowed transition.
  const resubmitDesign = async (order) => {
    setActionBusy(order.id);
    try {
      const updates = { design_approval_status: `pending` };
      if (resubmitFile && resubmitFile.dataUrl) {
        const res = await fetch(resubmitFile.dataUrl);
        const blob = await res.blob();
        const ext = blob.type.includes(`png`) ? `png` : `jpg`;
        const fileName = `design-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage.from(`designs`).upload(fileName, blob, { contentType: blob.type, upsert: false });
        if (!upErr && up) {
          const { data: urlData } = supabase.storage.from(`designs`).getPublicUrl(fileName);
          updates.design_url = urlData.publicUrl;
          updates.mockup_url = null; // re-composite from the saved position on display
        }
      }
      const { error } = await supabase.from(`orders`).update(updates).eq(`id`, order.id);
      if (error) throw error;
      setOrders(os => os.map(o => o.id === order.id ? { ...o, ...updates } : o));
      setResubmitOpenId(null);
      setResubmitFile(null);
    } catch (e) {
      console.error(`[resubmit] design resubmit failed:`, e);
      setActionError(uiGenericError(lang));
    }
    setActionBusy(null);
  };

  // Cancel an order from the approval flow. We only touch `status` — the
  // payment columns are server-protected and a customer write to them is a no-op.
  const cancelApprovalOrder = async (order) => {
    if (!window.confirm(t.approval.cancelConfirm)) return;
    setActionBusy(order.id);
    try {
      const { error } = await supabase.from(`orders`).update({ status: `cancelled` }).eq(`id`, order.id);
      if (error) throw error;
      setOrders(os => os.map(o => o.id === order.id ? { ...o, status: `cancelled` } : o));
    } catch (e) {
      console.error(`[cancel] order cancel failed:`, e);
      setActionError(uiGenericError(lang));
    }
    setActionBusy(null);
  };

  // Payment-return screen takes priority over the normal track view (and the
  // guest gate) so a customer coming back from Tranzila always sees confirmation.
  if (payReturn && !payReturnDismissed) {
    const ok = payReturnStatus === `succeeded`;
    const proc = payReturnStatus === `processing` || payReturnStatus === `loading`;
    const title = ok
      ? (lang === `he` ? `התשלום התקבל — תודה!` : lang === `ru` ? `Оплата получена — спасибо!` : `Payment received — thank you!`)
      : proc
      ? (lang === `he` ? `מאמתים את התשלום…` : lang === `ru` ? `Подтверждаем оплату…` : `Confirming your payment…`)
      : (lang === `he` ? `תודה! ההזמנה אצלנו` : lang === `ru` ? `Спасибо! Заказ получен` : `Thank you! Your order is in`);
    const sub = ok
      ? (lang === `he` ? `קיבלנו את התשלום וההזמנה נכנסה להפקה. נעדכן אותך במייל בכל שלב.` : lang === `ru` ? `Мы получили оплату, заказ передан в производство. Будем сообщать по email на каждом этапе.` : `We've received your payment and your order is in production. We'll email you at every step.`)
      : proc
      ? (lang === `he` ? `התשלום בעיבוד — נעדכן ברגע שהאישור יתקבל. אפשר לרענן בעוד רגע.` : lang === `ru` ? `Оплата обрабатывается — сообщим, как только подтвердится. Обновите через минуту.` : `Your payment is processing — we'll confirm shortly. Try refreshing in a moment.`)
      : (lang === `he` ? `קיבלנו את הפנייה. אם בוצע תשלום, אישור יישלח במייל בהקדם.` : lang === `ru` ? `Мы вас зафиксировали. Если оплата прошла, подтверждение придёт на email.` : `We've got you. If a payment went through, a confirmation email will arrive shortly.`);
    return (
      <div style={{ minHeight: `100vh`, background: COLORS.bg, display: `flex`, alignItems: `center`, justifyContent: `center`, padding: 24, direction: t.dir, fontFamily: `'Varela Round',sans-serif` }}>
        <div style={{ background: COLORS.bgCard, border: `1px solid ${ok ? `#22c55e` : COLORS.accent}`, borderRadius: 16, padding: `40px 32px`, width: `100%`, maxWidth: 460, textAlign: `center` }}>
          <div style={{ display: `inline-flex`, alignItems: `center`, justifyContent: `center`, width: 80, height: 80, borderRadius: `50%`, background: ok ? `rgba(34,197,94,0.12)` : `rgba(255,107,53,0.12)`, border: `2px solid ${ok ? `#22c55e` : COLORS.accent}`, marginBottom: 20, fontSize: 40 }}>{ok ? `✓` : proc ? `⏳` : `📦`}</div>
          <h2 style={{ color: COLORS.white, fontFamily: `'Playfair Display',serif`, fontSize: 26, margin: `0 0 10px` }}>{title}</h2>
          <p style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{sub}</p>
          {payReturn.orderGroup && (
            <div style={{ background: `rgba(255,107,53,0.08)`, border: `1px solid rgba(255,107,53,0.25)`, borderRadius: 10, padding: `10px 16px`, marginBottom: 24 }}>
              <div style={{ color: COLORS.gray, fontSize: 11, letterSpacing: `0.1em`, textTransform: `uppercase`, marginBottom: 3 }}>{lang === `he` ? `מספר הזמנה` : lang === `ru` ? `Номер заказа` : `Order number`}</div>
              <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 15, letterSpacing: `0.05em` }}>{`SXP-${payReturn.orderGroup.slice(-8).toUpperCase()}`}</div>
            </div>
          )}
          <button onClick={() => { try { window.history.replaceState({}, ``, `${window.location.pathname}#track`); } catch (_) {} setPayReturnDismissed(true); }}
            style={{ width: `100%`, background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 8, padding: `14px`, fontSize: 15, fontWeight: 700, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, marginBottom: 10 }}>
            {lang === `he` ? `למעקב ההזמנות שלי` : lang === `ru` ? `К моим заказам` : `View my orders`}
          </button>
          <button onClick={() => { window.location.hash = ``; }}
            style={{ width: `100%`, background: `transparent`, color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `12px`, fontSize: 14, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>
            {lang === `he` ? `חזרה לחנות` : lang === `ru` ? `Вернуться в магазин` : `Back to shop`}
          </button>
        </div>
      </div>
    );
  }

  if (!user) return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir, fontFamily: "'Varela Round',sans-serif" }}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 40, width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>📦</div>
          <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0 }}>{t.track.guestTitle}</h2>
          <p style={{ color: COLORS.gray, fontSize: 13.5, marginTop: 10, lineHeight: 1.6 }}>{t.track.guestDesc}</p>
        </div>
        {guestSent ? (
          <div style={{ color: COLORS.success, fontSize: 14, textAlign: "center", background: "rgba(74,222,128,0.1)", padding: "16px 14px", borderRadius: 10, lineHeight: 1.6 }}>
            {t.auth.magicLinkSent}
          </div>
        ) : (
          <>
            <label htmlFor="track-guest-email" style={{ color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{t.auth.email}</label>
            <input id="track-guest-email" type="email" inputMode="email" autoComplete="email" value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendTrackLink(); }}
              placeholder="your@email.com"
              style={{ width: "100%", boxSizing: "border-box", background: "#111", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none", marginTop: 8, marginBottom: 16 }} />
            {guestError && <div role="alert" style={{ color: "#f87171", fontSize: 13, marginBottom: 14, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{guestError}</div>}
            <button onClick={sendTrackLink} disabled={guestLoading || !guestEmail.trim()}
              style={{ width: "100%", background: (guestLoading || !guestEmail.trim()) ? COLORS.border : COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 700, cursor: (guestLoading || !guestEmail.trim()) ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif" }}>
              {guestLoading ? "..." : t.track.guestBtn}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <h1 className="reveal" style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 8 }}>{t.track.title}</h1>
        <p className="reveal" data-delay="1" style={{ color: COLORS.gray, marginBottom: 32 }}>{t.track.sub}</p>

        {actionError && (
          <div role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "#f87171", fontSize: 14, marginBottom: 20, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", padding: "12px 16px", borderRadius: 10 }}>
            <span>{actionError}</span>
            <button onClick={() => setActionError("")} style={{ background: "transparent", border: "1px solid rgba(248,113,113,0.5)", color: "#f87171", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{uiRetry(lang)}</button>
          </div>
        )}

        <AccountSettings lang={lang} />

        {loading ? <div style={{ color: COLORS.gray, textAlign: "center", padding: 40 }}>...</div> :
          orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: COLORS.gray }}>
              <div style={{ width: 48, height: 1, background: "rgba(255,107,53,0.4)", margin: "0 auto 20px" }}></div>
              <div style={{ fontSize: 22, fontFamily: "'Playfair Display',serif", fontStyle: "italic", color: "#777", marginBottom: 8 }}>—</div>
              <div style={{ fontSize: 16, color: "#888" }}>{t.track.noOrders}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).map((order, idx) => {
                const si = getStageIndex(order.status);
                const stage = ORDER_STAGES[si] || ORDER_STAGES[0];
                const isOpen = selected === order.id;
                const ap = order.design_approval_status;
                const isCancelled = order.status === "cancelled";
                const needsApproval = !isCancelled && ap && ap !== "not_required";
                const apMeta = { pending: { label: t.approval.underReview, color: "#facc15" }, approved: { label: t.approval.approvedTitle, color: COLORS.success }, rejected: { label: t.approval.changesTitle, color: "#f87171" } }[ap];
                return (
                  <div key={order.id} className="reveal" data-delay={String((idx % 6) + 1)} style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
                    <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div onClick={() => setSelected(isOpen ? null : order.id)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 16 }}>{localizeProduct(order.product, lang)} — {localizeVariant(order.variant, lang)}</div>
                        <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 4 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                        <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 2 }}>{timeAgo(order.created_at, lang)}</div>
                        {order.completed_at && <div style={{ color: COLORS.success, fontSize: 12, marginTop: 2 }}>✅ {lang === "he" ? "הושלם תוך" : lang === "ru" ? "Выполнен за" : "Completed in"} {timeBetween(order.created_at, order.completed_at, lang)}</div>}
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>₪{order.total}</div>
                        {isCancelled ? (
                          <div style={{ color: "#f87171", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f87171" }}></span>{t.approval.cancelled}</div>
                        ) : needsApproval ? (
                          <div style={{ color: apMeta.color, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", fontWeight: 700 }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: apMeta.color, boxShadow: `0 0 8px ${apMeta.color}66` }}></span>{apMeta.label}</div>
                        ) : (
                          <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: stage.dot, boxShadow: `0 0 8px ${stage.dot}66` }}></span>{stage[lang] || stage.en}</div>
                        )}
                      </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${COLORS.border}` }}>
                        {/* ── Custom-design approval state ── */}
                        {isCancelled && (
                          <div style={{ marginTop: 20, background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.4)`, borderRadius: 12, padding: "14px 18px", color: "#f87171", fontSize: 14, fontWeight: 700 }}>
                            {t.approval.cancelled}
                          </div>
                        )}
                        {needsApproval && ap === "pending" && (
                          <div style={{ marginTop: 20, background: "rgba(250,204,21,0.07)", border: `1px solid rgba(250,204,21,0.4)`, borderRadius: 12, padding: "16px 18px" }}>
                            <div style={{ color: "#facc15", fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><span aria-hidden="true">🔍</span>{t.approval.underReview}</div>
                            <div style={{ color: COLORS.gray, fontSize: 13.5, lineHeight: 1.6 }}>{t.approval.underReviewDesc}</div>
                          </div>
                        )}
                        {needsApproval && ap === "approved" && (
                          <div style={{ marginTop: 20, background: "rgba(74,222,128,0.07)", border: `1px solid rgba(74,222,128,0.4)`, borderRadius: 12, padding: "16px 18px" }}>
                            <div style={{ color: COLORS.success, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.approval.approvedTitle}</div>
                            <div style={{ color: COLORS.gray, fontSize: 13.5, lineHeight: 1.6, marginBottom: 14 }}>{t.approval.approvedDesc}</div>
                            <button onClick={() => payForApprovedOrder(order)} disabled={payBusy === order.id}
                              style={{ width: "100%", background: payBusy === order.id ? COLORS.bgCard : `linear-gradient(135deg, ${COLORS.accentBtn} 0%, #A8461A 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "16px 20px", fontSize: 16, fontWeight: 700, cursor: payBusy === order.id ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif", boxShadow: payBusy === order.id ? "none" : "0 8px 24px rgba(255,107,53,0.35)" }}>
                              {payBusy === order.id ? "..." : `${t.approval.payNow} · ₪${order.total}`}
                            </button>
                          </div>
                        )}
                        {needsApproval && ap === "rejected" && (
                          <div style={{ marginTop: 20, background: "rgba(248,113,113,0.07)", border: `1px solid rgba(248,113,113,0.4)`, borderRadius: 12, padding: "16px 18px" }}>
                            <div style={{ color: "#f87171", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t.approval.changesTitle}</div>
                            {order.design_review_note && (
                              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                                <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{t.approval.reviewNote}</div>
                                <div style={{ color: COLORS.white, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{order.design_review_note}</div>
                              </div>
                            )}
                            {resubmitOpenId === order.id ? (
                              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                                <label style={{ display: "block", color: COLORS.gray, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t.approval.uploadNew}</label>
                                <input type="file" accept="image/*" onChange={onResubmitFile} style={{ color: COLORS.gray, fontSize: 12, marginBottom: 10, width: "100%" }} />
                                {resubmitFile && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><img src={resubmitFile.dataUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 4, border: `1px solid ${COLORS.border}` }} /><span style={{ color: COLORS.success, fontSize: 12 }}>✓ {resubmitFile.name}</span></div>}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button onClick={() => resubmitDesign(order)} disabled={actionBusy === order.id} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: actionBusy === order.id ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif" }}>{actionBusy === order.id ? t.approval.resubmitting : t.approval.resubmitBtn}</button>
                                  <button onClick={() => { setResubmitOpenId(null); setResubmitFile(null); }} disabled={actionBusy === order.id} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>✕</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button onClick={() => { setResubmitOpenId(order.id); setResubmitFile(null); }} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.approval.editResubmit}</button>
                                <button onClick={() => cancelApprovalOrder(order)} disabled={actionBusy === order.id} style={{ background: "transparent", color: "#f87171", border: `1px solid rgba(248,113,113,0.5)`, borderRadius: 8, padding: "11px 20px", fontSize: 13.5, cursor: actionBusy === order.id ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.approval.cancelOrder}</button>
                              </div>
                            )}
                          </div>
                        )}
                        {order.design_url && (
                          <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
                                {lang === "he" ? "העיצוב שלך" : lang === "ru" ? "Ваш дизайн" : "Your design"}
                              </div>
                              <div style={{ background: COLORS.bg, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 8, width: 180 }}>
                                {order.mockup_url ? (
                                  // BLOOM orders: show the exact ready-made mockup the customer saw at checkout.
                                  <SmartImage src={order.mockup_url} alt={lang === "he" ? "תצוגת ההזמנה" : lang === "ru" ? "Превью заказа" : "Order preview"} style={{ width: "100%", display: "block", borderRadius: 8 }} />
                                ) : (
                                  // Custom orders: re-composite the design at the position the customer chose.
                                  (() => {
                                    const pname = order.product?.toLowerCase() || "";
                                    const pid = (pname.includes("mug") || pname.includes("ספל") || pname.includes("кружка")) ? "mug" : ((pname.includes("sticker") || pname.includes("מדבקה") || pname.includes("стикер")) && (pname.includes("square") || pname.includes("מרובע") || pname.includes("квадрат"))) ? "sticker_sq" : (pname.includes("sticker") || pname.includes("מדבקה") || pname.includes("стикер")) ? "sticker" : (pname.includes("oversize") || pname.includes("אוברסייז") || pname.includes("оверсайз")) ? "oversized" : (pname.includes("dryfit") || pname.includes("dry") || pname.includes("דרייפיט") || pname.includes("драйфит")) ? "dryfit" : "tshirt";
                                    return <ProductMockupBase productKey={pid} color={order.product_color || "#ffffff"} imageUrl={order.design_url} imagePos={{ x: order.design_x ?? 150, y: order.design_y ?? 130, size: order.design_size ?? 100 }} secondImageUrl={order.second_front_url && order.second_front_url !== order.design_url ? order.second_front_url : (order.second_front_url ? order.design_url : null)} secondImagePos={order.second_front_url ? { x: order.second_front_x ?? 210, y: order.second_front_y ?? 120, size: order.second_front_size ?? 85 } : null} />;
                                  })()
                                )}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, maxWidth: 180 }}>
                                {order.product_color && <div style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.bg, borderRadius: 6, padding: "3px 7px", fontSize: 10, color: COLORS.gray }}><div style={{ width: 9, height: 9, borderRadius: "50%", background: order.product_color, border: "1px solid #555" }} />{order.product_color}</div>}
                                {order.design_size && !order.mockup_url && <div style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 7px", fontSize: 10, color: COLORS.gray }}>~{Math.round((order.design_size / 160) * 30)} cm</div>}
                                {order.back_print && <div style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>BACK</div>}
                                {order.second_front_url && <div style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>+1</div>}
                                {order.sleeve_left_url && <div style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>L-SL</div>}
                                {order.sleeve_right_url && <div style={{ background: COLORS.bg, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>R-SL</div>}
                              </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
                                {lang === "he" ? "הוסף הערה להזמנה" : lang === "ru" ? "Добавить заметку" : "Add a note"}
                              </div>
                              {canEditMessage(order.status) ? (
                                <>
                                  <textarea value={msgDrafts[order.id] || ""} onChange={e => setMsgDrafts(d => ({ ...d, [order.id]: e.target.value }))} placeholder={lang === "he" ? "הערה למפעיל ההזמנה — בקשות מיוחדות, שינויים וכו'" : lang === "ru" ? "Заметка для исполнителя — особые пожелания и т.п." : "Note to the producer — special requests, etc."} rows={4} style={{ width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 13, outline: "none", resize: "vertical" }} />
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                                    <button onClick={() => saveCustomerMessage(order.id)} disabled={savingMsg[order.id] || (msgDrafts[order.id] || "") === (order.customer_message || "")} style={{ background: ((msgDrafts[order.id] || "") === (order.customer_message || "")) ? COLORS.bgCard : COLORS.accent, color: ((msgDrafts[order.id] || "") === (order.customer_message || "")) ? COLORS.gray : "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: ((msgDrafts[order.id] || "") === (order.customer_message || "")) ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600 }}>
                                      {savingMsg[order.id] ? "..." : (lang === "he" ? "💾 שמור הערה" : lang === "ru" ? "💾 Сохранить" : "💾 Save note")}
                                    </button>
                                    {order.customer_message && (msgDrafts[order.id] || "") === order.customer_message && (
                                      <span style={{ color: COLORS.success, fontSize: 12 }}>✓ {lang === "he" ? "נשמר" : lang === "ru" ? "Сохранено" : "Saved"}{order.customer_message_at ? ` · ${new Date(order.customer_message_at).toLocaleString(lang === "he" ? "he-IL" : lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · ${timeAgo(order.customer_message_at, lang)}` : ""}</span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  {order.customer_message ? (
                                    <div style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 12px", color: COLORS.white, fontSize: 13, fontFamily: "'Varela Round',sans-serif" }}>
                                      {order.customer_message_at && (
                                        <div style={{ color: COLORS.gray, fontSize: 11, marginBottom: 6 }}>{new Date(order.customer_message_at).toLocaleString(lang === "he" ? "he-IL" : lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {timeAgo(order.customer_message_at, lang)}</div>
                                      )}
                                      {order.customer_message}
                                    </div>
                                  ) : (
                                    <div style={{ color: COLORS.gray, fontSize: 12, fontStyle: "italic" }}>
                                      {lang === "he" ? "לא ניתן להוסיף הערות אחרי שהפריט עבר לשלב הדפסה" : lang === "ru" ? "Невозможно добавить заметку после начала печати" : "Cannot add notes after item moved to printing"}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {!isCancelled && <div style={{ marginTop: 20 }}>
                          {ORDER_STAGES.map((s, i) => {
                            const done = i <= si;
                            const active = i === si;
                            return (
                              <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: i < ORDER_STAGES.length - 1 ? 0 : 0 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? (active ? s.dot : COLORS.accent) : COLORS.bg, border: `2px solid ${done ? (active ? s.dot : COLORS.accent) : COLORS.border}`, fontSize: 16, color: "#fff", fontWeight: 700, transition: "all 0.3s", boxShadow: active ? `0 0 14px ${s.dot}` : "none" }}>
                                    {done ? (i === si ? "●" : "✓") : ""}
                                  </div>
                                  {i < ORDER_STAGES.length - 1 && <div style={{ width: 2, height: 32, background: done && i < si ? COLORS.accent : COLORS.border, transition: "background 0.3s" }} />}
                                </div>
                                <div style={{ paddingTop: 8, paddingBottom: i < ORDER_STAGES.length - 1 ? 24 : 0 }}>
                                  <div style={{ color: done ? COLORS.white : COLORS.gray, fontWeight: active ? 700 : 400, fontSize: 15 }}>{s[lang] || s.en}</div>
                                  {active && <div style={{ color: COLORS.accent, fontSize: 12, marginTop: 2 }}>● {lang === "he" ? "סטטוס נוכחי" : lang === "ru" ? "Текущий статус" : "Current status"}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Payments-coming-soon modal — reused while Tranzila is off (the
          create-payment 503 / PAYMENTS_ENABLED=false path lands here). */}
      {paySoon && (typeof document !== `undefined` ? createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setPaySoon(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, backdropFilter: "blur(4px)", direction: t.dir }}>
          <div ref={paySoonRef} role="dialog" aria-modal="true" aria-label={t.payment.soonTitle} onKeyDown={(e) => { if (e.key === "Escape") setPaySoon(false); }} style={{ position: "relative", background: "#1a1a1a", border: `1px solid ${COLORS.accent}`, borderRadius: 16, padding: "36px 32px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(255,107,53,0.2)" }}>
            <button onClick={() => setPaySoon(false)} aria-label={LANGS[lang].bloom.closeModal}
              style={{ position: "absolute", top: 12, insetInlineEnd: 12, width: 32, height: 32, borderRadius: "50%", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, cursor: "pointer", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Varela Round',sans-serif" }}>×</button>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: COLORS.accent, display: "inline-block", boxShadow: `0 0 30px rgba(255,107,53,0.7)` }}></span>
            </div>
            <h3 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 14 }}>{t.payment.soonTitle}</h3>
            <p style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{t.payment.soonSub}</p>
            <button onClick={() => setPaySoon(false)} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", width: "100%" }}>{t.payment.soonBtn}</button>
          </div>
        </div>
      , document.body) : null)}
    </div>
  );
}

// Admin Dashboard
function AdminPage({ lang }) {
  const t = LANGS[lang];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // BLOOM characters — manage the is_bestseller / is_new flags from here.
  const [petDesigns, setPetDesigns] = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  // Inline edit / add forms for the catalog manager. editingDesignId points at
  // the row currently expanded in edit mode; addingDesign is a flag for the
  // "+ Add new" blank form at the top. designForm carries the live form state.
  // Same shape for sticker_packs.
  const BLANK_DESIGN = {
    slug: ``, name_he: ``, name_en: ``, name_ru: ``,
    animal_he: ``, animal_en: ``, animal_ru: ``,
    tagline_he: ``, tagline_en: ``, tagline_ru: ``,
    species: `dog`, breed_he: ``, breed_en: ``, breed_ru: ``, breed_aliases: ``,
    price_shirt: 129, price_mug: 59, price_sticker: 25,
    price_shirt_basic: 99, price_shirt_oversized: 119, price_sticker_pack: 35,
    mockup_url: ``, mockup_shirt_url: ``, mockup_mug_url: ``, design_url: ``, mockup_bg: ``,
    sort_order: 0, is_active: true, is_bestseller: false, is_new: false,
  };
  const BLANK_PACK = {
    slug: ``, name_he: ``, name_en: ``, name_ru: ``,
    species: `mixed`, price: 35, image_url: ``, item_slugs: ``,
    sort_order: 0, is_active: true,
  };
  const [editingDesignId, setEditingDesignId] = useState(null);
  const [addingDesign, setAddingDesign] = useState(false);
  const [designForm, setDesignForm] = useState(BLANK_DESIGN);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [editingPackId, setEditingPackId] = useState(null);
  const [addingPack, setAddingPack] = useState(false);
  const [packForm, setPackForm] = useState(BLANK_PACK);
  // Lightweight global busy flag so the form disables its Save button while
  // an upload + insert is in flight (prevents double-save from impatient
  // double-clicks).
  const [catalogBusy, setCatalogBusy] = useState(false);
  // Waitlist dashboard (read-only). The admin SELECT policy on public.waitlist
  // (USING is_admin()) already exists, so this reads under the admin session.
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  // Surface a banner if any admin fetch fails (instead of a silent blank/empty).
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setFetchError(false);
    fetchOrders();
    fetchPetDesigns();
    fetchStickerPacks();
    fetchWaitlist();
    const sub = supabase.channel("orders-changes").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders).subscribe();
    return () => sub.unsubscribe();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error("Admin fetchOrders failed:", e);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchPetDesigns = async () => {
    try {
      const { data, error } = await supabase
        .from("pet_designs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setPetDesigns(data || []);
    } catch (e) {
      console.error("Admin fetchPetDesigns failed:", e);
      setFetchError(true);
    } finally {
      setPetsLoading(false);
    }
  };

  const fetchStickerPacks = async () => {
    try {
      const { data, error } = await supabase
        .from("sticker_packs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setStickerPacks(data || []);
    } catch (e) {
      console.error("Admin fetchStickerPacks failed:", e);
      setFetchError(true);
    } finally {
      setPacksLoading(false);
    }
  };

  // Read-only waitlist fetch for the dashboard. Newest first; all stats are
  // computed client-side (the list is small pre-launch). RLS: admin-only SELECT.
  const fetchWaitlist = async () => {
    const { data } = await supabase
      .from("waitlist")
      .select("email,lang,source,created_at,breed_interest")
      .order("created_at", { ascending: false });
    setWaitlist(data || []);
    setWaitlistLoading(false);
  };

  // Optimistic toggle for is_bestseller / is_new. Reverts on DB error.
  const togglePetFlag = async (id, field, value) => {
    setPetDesigns(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    const { error } = await supabase.from("pet_designs").update({ [field]: value }).eq("id", id);
    if (error) {
      console.error(`Failed to update ${field}:`, error);
      setPetDesigns(prev => prev.map(d => d.id === id ? { ...d, [field]: !value } : d));
    }
  };

  // Upload a File from the admin form to the named Storage bucket and return
  // the public URL. Bucket must already exist + be public (mockups, designs).
  // Filenames are randomized to avoid collisions and let the same row be
  // re-uploaded without an upsert.
  const uploadAdminImage = async (bucket, file, prefix) => {
    if (!file) return null;
    const ext = (file.name?.split(`.`).pop() || `webp`).toLowerCase().replace(/[^a-z0-9]/g, ``) || `webp`;
    const fileName = `${prefix || `admin`}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });
    if (error) {
      console.error(`Upload to ${bucket} failed:`, error);
      throw error;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  // Save a pet_designs row. existingId === null means INSERT, else UPDATE.
  // formValues carries the raw form state; we coerce numeric fields and
  // strip empty strings to nulls so the DB doesn't store "" for optional cols.
  const savePetDesign = async (formValues, existingId) => {
    setCatalogBusy(true);
    try {
      const row = {
        slug: formValues.slug?.trim() || null,
        name_he: formValues.name_he || null,
        name_en: formValues.name_en || null,
        name_ru: formValues.name_ru || null,
        animal_he: formValues.animal_he || null,
        animal_en: formValues.animal_en || null,
        animal_ru: formValues.animal_ru || null,
        tagline_he: formValues.tagline_he || null,
        tagline_en: formValues.tagline_en || null,
        tagline_ru: formValues.tagline_ru || null,
        species: formValues.species || null,
        breed_he: formValues.breed_he || null,
        breed_en: formValues.breed_en || null,
        breed_ru: formValues.breed_ru || null,
        breed_aliases: formValues.breed_aliases || null,
        price_shirt: Number(formValues.price_shirt) || null,
        price_mug: Number(formValues.price_mug) || null,
        price_sticker: Number(formValues.price_sticker) || null,
        price_shirt_basic: Number(formValues.price_shirt_basic) || null,
        price_shirt_oversized: Number(formValues.price_shirt_oversized) || null,
        price_sticker_pack: Number(formValues.price_sticker_pack) || null,
        mockup_url: formValues.mockup_url || null,
        mockup_shirt_url: formValues.mockup_shirt_url || null,
        mockup_mug_url: formValues.mockup_mug_url || null,
        design_url: formValues.design_url || null,
        mockup_bg: formValues.mockup_bg || null,
        sort_order: Number(formValues.sort_order) || 0,
        is_active: !!formValues.is_active,
        is_bestseller: !!formValues.is_bestseller,
        is_new: !!formValues.is_new,
      };
      if (existingId) {
        const { error } = await supabase.from(`pet_designs`).update(row).eq(`id`, existingId);
        if (error) throw error;
      } else {
        if (!row.slug) {
          alert(`Slug is required`);
          setCatalogBusy(false);
          return false;
        }
        const { error } = await supabase.from(`pet_designs`).insert(row);
        if (error) throw error;
      }
      await fetchPetDesigns();
      setEditingDesignId(null);
      setAddingDesign(false);
      return true;
    } catch (e) {
      console.error(`Save pet_designs failed:`, e);
      alert(`Save failed: ${e.message || e}`);
      return false;
    } finally {
      setCatalogBusy(false);
    }
  };

  const deletePetDesign = async (id) => {
    if (!window.confirm(`Delete this BLOOM design permanently? Existing orders that reference it stay intact, but it will disappear from the catalog and home carousel.`)) return;
    setCatalogBusy(true);
    try {
      const { error } = await supabase.from(`pet_designs`).delete().eq(`id`, id);
      if (error) throw error;
      await fetchPetDesigns();
      if (editingDesignId === id) setEditingDesignId(null);
    } catch (e) {
      console.error(`Delete pet_designs failed:`, e);
      alert(`Delete failed: ${e.message || e}`);
    } finally {
      setCatalogBusy(false);
    }
  };

  const saveStickerPack = async (formValues, existingId) => {
    setCatalogBusy(true);
    try {
      const items = (formValues.item_slugs || ``).split(`,`).map(s => s.trim()).filter(Boolean);
      const row = {
        slug: formValues.slug?.trim() || null,
        name_he: formValues.name_he || null,
        name_en: formValues.name_en || null,
        name_ru: formValues.name_ru || null,
        species: formValues.species || `mixed`,
        price: Number(formValues.price) || 35,
        image_url: formValues.image_url || null,
        item_slugs: items,
        sort_order: Number(formValues.sort_order) || 0,
        is_active: !!formValues.is_active,
      };
      if (existingId) {
        const { error } = await supabase.from(`sticker_packs`).update(row).eq(`id`, existingId);
        if (error) throw error;
      } else {
        if (!row.slug) {
          alert(`Slug is required`);
          setCatalogBusy(false);
          return false;
        }
        const { error } = await supabase.from(`sticker_packs`).insert(row);
        if (error) throw error;
      }
      await fetchStickerPacks();
      setEditingPackId(null);
      setAddingPack(false);
      return true;
    } catch (e) {
      console.error(`Save sticker_packs failed:`, e);
      alert(`Save failed: ${e.message || e}`);
      return false;
    } finally {
      setCatalogBusy(false);
    }
  };

  const deleteStickerPack = async (id) => {
    if (!window.confirm(`Delete this sticker pack permanently?`)) return;
    setCatalogBusy(true);
    try {
      const { error } = await supabase.from(`sticker_packs`).delete().eq(`id`, id);
      if (error) throw error;
      await fetchStickerPacks();
      if (editingPackId === id) setEditingPackId(null);
    } catch (e) {
      console.error(`Delete sticker_packs failed:`, e);
      alert(`Delete failed: ${e.message || e}`);
    } finally {
      setCatalogBusy(false);
    }
  };

  const deleteOrder = async (orderIdOrIds) => {
    const ids = Array.isArray(orderIdOrIds) ? orderIdOrIds : [orderIdOrIds];
    for (const orderId of ids) {
      await supabase.from("order_status_history").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
    }
    setDeleteConfirm(null);
    setSelected(null);
    fetchOrders();
  };

  const updateStatus = async (orderId, status, orderCreatedAt, sendEmail = true) => {
    const updates = { status };
    if (status === "delivered") updates.completed_at = new Date().toISOString();
    await supabase.from("orders").update(updates).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status });

    const order = orders.find(o => o.id === orderId);
    if (sendEmail && order?.customer_email) {
      try {
        await supabase.functions.invoke("send-status-update", {
          body: {
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            product: order.product,
            newStatus: status,
            orderId: orderId,
            language: order.language || "he",
          },
        });
      } catch (emailErr) {
        console.error("Status email error:", emailErr);
      }
    }

    fetchOrders();
  };

  const statusColors = { received: COLORS.accent, design: "#a78bfa", printing: "#60a5fa", ready: "#facc15", shipped: "#fb923c", delivered: COLORS.success };

  // Sticky admin section nav — one-click jump to each section. Sections are all
  // rendered (no behavior change); we just smooth-scroll to them and highlight
  // the one currently in view. Offset accounts for the fixed site nav (72) +
  // this sticky bar (~58).
  const ADMIN_NAV_OFFSET = 132;
  const adminSections = [
    { id: `admin-orders`, label: (t.admin && t.admin.orders) || (lang === `he` ? `הזמנות` : lang === `ru` ? `Заказы` : `Orders`) },
    { id: `admin-pets`, label: `BLOOM` },
    { id: `admin-packs`, label: lang === `he` ? `מדבקות` : lang === `ru` ? `Наклейки` : `Sticker packs` },
    { id: `admin-blog`, label: t.navBlog || `Blog` },
    { id: `admin-approvals`, label: lang === `he` ? `אישור עיצובים` : lang === `ru` ? `Одобрение дизайнов` : `Design approvals` },
    { id: `admin-waitlist`, label: lang === `he` ? `רשימת המתנה` : lang === `ru` ? `Лист ожидания` : `Waitlist` },
  ];
  const [activeSection, setActiveSection] = useState(`admin-orders`);
  const suppressSpy = useRef(false); // ignore scroll-spy while a click-scroll animates
  const scrollToSection = (id) => {
    setActiveSection(id); // clicked section is the active one immediately
    const el = document.getElementById(id);
    if (!el) return;
    // Suppress the scroll-spy for the whole programmatic animation so it can't
    // briefly re-highlight a section we're scrolling past. Release on scrollend
    // (no further scroll fires after, so the clicked section stays active), with
    // a generous fallback for browsers without scrollend.
    suppressSpy.current = true;
    const release = () => { suppressSpy.current = false; window.removeEventListener(`scrollend`, release); };
    window.addEventListener(`scrollend`, release, { once: true });
    setTimeout(release, 2500);
    const y = el.getBoundingClientRect().top + window.scrollY - ADMIN_NAV_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: `smooth` });
  };
  useEffect(() => {
    const onScroll = () => {
      if (suppressSpy.current) return;
      // Active = the last section whose top has scrolled to/above the bar
      // (tolerant band so it tracks correctly once a smooth-scroll settles).
      let current = adminSections[0].id;
      for (const s of adminSections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= ADMIN_NAV_OFFSET + 40) current = s.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener(`scroll`, onScroll, { passive: true });
    return () => window.removeEventListener(`scroll`, onScroll);
  }, []);

  // ── Waitlist dashboard derived data (read-only, computed client-side) ──
  const wlRecent = waitlist.slice(0, 20);
  const wlBreedCounts = {};
  waitlist.forEach(r => { const b = (r.breed_interest || ``).trim(); if (b) wlBreedCounts[b] = (wlBreedCounts[b] || 0) + 1; });
  const wlTopBreeds = Object.entries(wlBreedCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const wlBreedLabel = (slug) => { const d = petDesigns.find(p => p.slug === slug); return d ? (d[`name_${lang}`] || d.name_he || d[`breed_${lang}`] || slug) : slug; };
  const wlSourceLabel = (s) => {
    if (!s) return `—`;
    const m = {
      coming_soon: { he: `דף "בקרוב"`, en: `Coming-soon page`, ru: `Страница «Скоро»` },
      breed: { he: `עניין בגזע`, en: `Breed interest`, ru: `Интерес к породе` },
      hero: { he: `עמוד הבית`, en: `Homepage`, ru: `Главная` },
    };
    return (m[s] && (m[s][lang] || m[s].en)) || s;
  };
  const wlDate = (d) => { try { return new Date(d).toLocaleDateString(lang === `he` ? `he-IL` : lang === `ru` ? `ru-RU` : `en-US`, { day: `2-digit`, month: `2-digit`, year: `numeric` }); } catch { return ``; } };

  // ── Pending design-approval queue (custom uploads awaiting review) ──
  // Derived from the live orders list (the realtime subscription keeps it fresh),
  // newest first. Approve / request-changes write back via reviewDesign().
  const pendingApprovals = orders
    .filter(o => o.design_approval_status === `pending`)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const reviewDesign = async (orderId, decision) => {
    const updates = { design_approval_status: decision, design_reviewed_at: new Date().toISOString() };
    if (decision === `rejected`) {
      const note = window.prompt(lang === `he` ? `מה צריך לתקן בעיצוב? (ההערה תישלח ללקוח)` : lang === `ru` ? `Что нужно изменить? (комментарий увидит клиент)` : `What needs to change? (the customer will see this note)`);
      if (note === null) return; // admin cancelled the prompt
      updates.design_review_note = note;
    }
    await supabase.from(`orders`).update(updates).eq(`id`, orderId);
    fetchOrders();
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {fetchError && (
          <div role="alert" style={{ background: "rgba(248,113,113,0.12)", border: "1px solid #f87171", color: "#f87171", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>{lang === "he" ? "⚠️ טעינת חלק מהנתונים נכשלה. בדקו את החיבור ונסו לרענן." : lang === "ru" ? "⚠️ Не удалось загрузить часть данных. Проверьте соединение и обновите." : "⚠️ Some data failed to load. Check your connection and reload."}</span>
            <button onClick={() => { setFetchError(false); setLoading(true); setPetsLoading(true); setPacksLoading(true); fetchOrders(); fetchPetDesigns(); fetchStickerPacks(); }}
              style={{ background: "#f87171", color: "#0f0f0f", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", whiteSpace: "nowrap" }}>
              {lang === "he" ? "רענון" : lang === "ru" ? "Обновить" : "Reload"}
            </button>
          </div>
        )}
        {/* Sticky section nav — one-click jump to any admin section. Stays just
            below the fixed site nav (72px); horizontally scrollable on mobile. */}
        <nav aria-label="Admin sections" style={{
          position: "sticky", top: 72, zIndex: 90,
          display: "flex", gap: 8, alignItems: "center",
          background: "rgba(15,15,15,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${COLORS.border}`, borderRadius: 12,
          padding: "10px 12px", marginBottom: 28,
          overflowX: "auto", WebkitOverflowScrolling: "touch",
        }}>
          {adminSections.map(s => {
            const active = activeSection === s.id;
            return (
              <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}
                aria-current={active ? "location" : undefined}
                style={{
                  flexShrink: 0,
                  background: active ? COLORS.accent : "transparent",
                  color: active ? "#fff" : COLORS.gray,
                  border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                  borderRadius: 999, padding: "8px 18px",
                  fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                }}
                onMouseOver={e => { if (!active) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = COLORS.accent; } }}
                onMouseOut={e => { if (!active) { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.borderColor = COLORS.border; } }}>
                {s.label}
              </button>
            );
          })}
        </nav>
        <div id="admin-orders" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36 }}>{t.admin.title}</h2>
            <p style={{ color: COLORS.gray, marginTop: 4 }}>{orders.length} {t.admin.total}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ORDER_STAGES.map(s => (
              <div key={s.key} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ color: statusColors[s.key] || COLORS.accent, fontWeight: 700, fontSize: 18 }}>{orders.filter(o => o.status === s.key).length}</div>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: s.dot }}></span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["all", ...ORDER_STAGES.map(s => s.key)].map(key => {
            const stage = ORDER_STAGES.find(s => s.key === key);
            const count = key === "all" ? orders.length : orders.filter(o => o.status === key).length;
            return (
              <button key={key} onClick={() => setFilterStatus(key)} style={{
                background: filterStatus === key ? (key === "all" ? COLORS.accent : statusColors[key] || COLORS.accent) : COLORS.bgCard,
                border: `1px solid ${filterStatus === key ? (key === "all" ? COLORS.accent : statusColors[key] || COLORS.accent) : COLORS.border}`,
                color: filterStatus === key ? "#000" : COLORS.gray,
                borderRadius: 8, padding: "8px 14px", cursor: "pointer",
                fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600,
                transition: "all 0.2s",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}>
                {key !== "all" && stage && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: filterStatus === key ? "#000" : stage.dot }}></span>}
                {key === "all" ? (lang === "he" ? "הכל" : lang === "ru" ? "Все" : "All") : (stage[lang] || stage.en)} ({count})
              </button>
            );
          })}
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "2px solid #ef4444", marginBottom: 16, color: "#ef4444", fontSize: 28, fontWeight: 700 }}>!</div>
              <div style={{ color: COLORS.white, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {lang === "he" ? "למחוק את ההזמנה?" : lang === "ru" ? "Удалить заказ?" : "Delete this order?"}
              </div>
              <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
                {lang === "he" ? "לא ניתן לשחזר פעולה זו" : lang === "ru" ? "Это действие нельзя отменить" : "This action cannot be undone"}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
                  {lang === "he" ? "ביטול" : lang === "ru" ? "Отмена" : "Cancel"}
                </button>
                <button onClick={() => deleteOrder(deleteConfirm)} style={{ background: "#ef4444", border: "none", color: "#fff", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {lang === "he" ? "מחק" : lang === "ru" ? "Удалить" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? <div style={{ color: COLORS.gray, textAlign: "center", padding: 40 }}>Loading...</div> :
          (filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: COLORS.gray }}>
              <div style={{ width: 48, height: 1, background: "rgba(255,107,53,0.4)", margin: "0 auto 20px" }}></div>
              <div style={{ fontSize: 22, fontFamily: "'Playfair Display',serif", fontStyle: "italic", color: "#777", marginBottom: 8 }}>—</div>
              <div style={{ fontSize: 16, color: "#888" }}>{t.admin.noOrders}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(() => {
                const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
                // Group orders by order_group (or treat individual orders as their own group)
                const groupsMap = {};
                for (const o of filtered) {
                  const key = o.order_group || `single-${o.id}`;
                  if (!groupsMap[key]) groupsMap[key] = [];
                  groupsMap[key].push(o);
                }
                const groups = Object.values(groupsMap).sort((a, b) => new Date(b[0].created_at) - new Date(a[0].created_at));
                return groups.map(group => {
                  const order = group[0]; // primary order — has customer info + first item
                  const groupTotal = group.reduce((sum, o) => sum + (o.total || 0), 0);
                  const stage = ORDER_STAGES.find(s => s.key === order.status) || ORDER_STAGES[0];
                  const isOpen = selected === order.id;
                  const isMulti = group.length > 1;
                return (
                  <div key={order.id}
                    style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "16px 20px", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div onClick={() => setSelected(isOpen ? null : order.id)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[order.status] || COLORS.accent, boxShadow: `0 0 8px ${statusColors[order.status] || COLORS.accent}`, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: COLORS.white, fontWeight: 600 }}>{order.customer_name}{isMulti ? <span style={{ color: COLORS.accent, fontSize: 12, marginInline: 8, background: "rgba(255,107,53,0.15)", padding: "2px 10px", borderRadius: 10, letterSpacing: "0.05em" }}>{group.length} {lang === "he" ? "פריטים" : lang === "ru" ? "тов." : "items"}</span> : null}</div>
                            <div style={{ color: COLORS.gray, fontSize: 13 }}>{isMulti ? group.map(o => `${localizeProduct(o.product, lang)} ×${o.quantity}`).join(" · ") : `${localizeProduct(order.product, lang)} · ${localizeVariant(order.variant, lang)} · ×${order.quantity}`}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "end" }}>
                          <div style={{ color: COLORS.accent, fontWeight: 700 }}>₪{groupTotal}</div>
                          <div style={{ color: statusColors[order.status], fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: stage.dot, boxShadow: `0 0 6px ${stage.dot}66` }}></span>{stage[lang] || stage.en}</div>
                          <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{timeAgo(order.created_at, lang)}</div>
                          {order.completed_at && <div style={{ color: COLORS.success, fontSize: 11, marginTop: 2 }}>✓ {timeBetween(order.created_at, order.completed_at, lang)}</div>}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(group.map(o => o.id)); }} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: "#ef4444", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13, marginInlineStart: 12, flexShrink: 0, fontWeight: 700 }}>×</button>
                    </div>

                    {isOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>{t.admin.customer}</div>
                            <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>{order.customer_email}</div>
                            {order.customer_phone && <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>{order.customer_phone}</div>}
                            {(order.customer_street || order.customer_city) && <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>{[order.customer_street, order.customer_city, order.customer_postal_code].filter(Boolean).join(", ")}</div>}
                            {order.notes && <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 8, background: COLORS.bg, padding: "8px 12px", borderRadius: 6 }}>{order.notes}</div>}
                            {group.some(o => o.customer_message) && (
                              <div style={{ marginTop: 8 }}>
                                {group.filter(o => o.customer_message).map(o => (
                                  <div key={`msg-${o.id}`} style={{ background: "rgba(255,107,53,0.1)", border: `1px solid ${COLORS.accent}`, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                                      <div style={{ color: COLORS.accent, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                                        📩 {lang === "he" ? `הערת לקוח על ${localizeProduct(o.product, lang)}` : lang === "ru" ? `Заметка к ${localizeProduct(o.product, lang)}` : `Note on ${localizeProduct(o.product, lang)}`}
                                      </div>
                                      {o.customer_message_at && (
                                        <div style={{ color: COLORS.gray, fontSize: 10 }}>
                                          {new Date(o.customer_message_at).toLocaleString(lang === "he" ? "he-IL" : lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {timeAgo(o.customer_message_at, lang)}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ color: COLORS.white, fontSize: 13 }}>{o.customer_message}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ flexBasis: "100%", marginTop: 8, paddingTop: 16, borderTop: `1px dashed ${COLORS.border}` }}>
                            <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.15em" }}>{lang === "he" ? "פריטים בהזמנה" : lang === "ru" ? "Товары в заказе" : "Items in order"}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                              {group.map(it => (
                                <div key={it.id} style={{ background: COLORS.bg, borderRadius: 10, padding: 12, border: `1px solid ${COLORS.border}` }}>
                                  <div style={{ color: COLORS.white, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{localizeProduct(it.product, lang)} × {it.quantity}</div>
                                  <div style={{ color: COLORS.gray, fontSize: 11, marginBottom: 8 }}>{localizeVariant(it.variant, lang)} · ₪{it.total}</div>
                                  {/* Pet-name personalization — printed in-house, so the name, font
                                      and colour read prominently here. Only shows when supplied. */}
                                  <AdminPetNameBlock order={it} lang={lang} />
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                                    {(it.product_color || it.color) && <div style={{ display: "flex", alignItems: "center", gap: 5, background: COLORS.bgCard, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.gray }}><div style={{ width: 11, height: 11, borderRadius: "50%", background: it.product_color || it.color, border: "1px solid #555", flexShrink: 0 }} />{colorName(it.product_color || it.color, lang)}</div>}
                                    {it.design_size && <div style={{ background: COLORS.bgCard, borderRadius: 6, padding: "3px 7px", fontSize: 10, color: COLORS.gray }}>~{Math.round((it.design_size / 160) * 30)} cm</div>}
                                    {it.back_print && <div style={{ background: COLORS.bgCard, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>BACK</div>}
                                    {it.second_front_url && <div style={{ background: COLORS.bgCard, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>+1</div>}
                                    {it.sleeve_left_url && <div style={{ background: COLORS.bgCard, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>L-SL</div>}
                                    {it.sleeve_right_url && <div style={{ background: COLORS.bgCard, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: COLORS.accent, fontWeight: 700, letterSpacing: "0.05em" }}>R-SL</div>}
                                  </div>
                                  {it.design_url && (
                                    <div style={{ background: COLORS.bgCard, borderRadius: 8, padding: 6, marginBottom: 8 }}>
                                      {it.mockup_url ? (
                                        // Show the ready-made mockup the customer actually saw (BLOOM orders).
                                        <SmartImage src={it.mockup_url} alt="Order preview" style={{ width: "100%", display: "block", borderRadius: 6 }} />
                                      ) : (
                                        // Older / custom orders: re-composite the design at the saved position.
                                        (() => {
                                          const pname = it.product?.toLowerCase() || "";
                                          const pid = (pname.includes("mug") || pname.includes("ספל") || pname.includes("кружка")) ? "mug" : ((pname.includes("sticker") || pname.includes("מדבקה") || pname.includes("стикер")) && (pname.includes("square") || pname.includes("מרובע") || pname.includes("квадрат"))) ? "sticker_sq" : (pname.includes("sticker") || pname.includes("מדבקה") || pname.includes("стикер")) ? "sticker" : (pname.includes("oversize") || pname.includes("אוברסייז") || pname.includes("оверсайз")) ? "oversized" : (pname.includes("dryfit") || pname.includes("dry") || pname.includes("דרייפיט") || pname.includes("драйфит")) ? "dryfit" : "tshirt";
                                          return <ProductMockupBase productKey={pid} color={it.product_color || "#ffffff"} imageUrl={it.design_url} imagePos={{ x: it.design_x ?? 150, y: it.design_y ?? 130, size: it.design_size ?? 100 }} secondImageUrl={it.second_front_url && it.second_front_url !== it.design_url ? it.second_front_url : (it.second_front_url ? it.design_url : null)} secondImagePos={it.second_front_url ? { x: it.second_front_x ?? 210, y: it.second_front_y ?? 120, size: it.second_front_size ?? 85 } : null} />;
                                        })()
                                      )}
                                    </div>
                                  )}
                                  {it.design_url && (
                                    <button onClick={async () => {
                                      const response = await fetch(it.design_url);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url; a.download = `design-${it.id}.png`;
                                      document.body.appendChild(a); a.click();
                                      document.body.removeChild(a); window.URL.revokeObjectURL(url);
                                    }} style={{ background: "rgba(255,107,53,0.15)", border: "1px solid #FF6B35", color: "#FF6B35", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>⬇️ Download</button>
                                  )}
                                  {/* Extra design downloads */}
                                  {[
                                    { url: it.second_front_url, label: "2nd" },
                                    { url: it.back_design_url,  label: "Back" },
                                    { url: it.sleeve_left_url,  label: "SL" },
                                    { url: it.sleeve_right_url, label: "SR" },
                                  ].filter(d => d.url && d.url !== it.design_url).map(d => (
                                    <button key={d.label} onClick={async () => {
                                      const response = await fetch(d.url);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url; a.download = `${d.label}-${it.id}.png`;
                                      document.body.appendChild(a); a.click();
                                      document.body.removeChild(a); window.URL.revokeObjectURL(url);
                                    }} style={{ background: "rgba(255,107,53,0.1)", border: "1px solid #FF6B35", color: "#FF6B35", borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", marginInlineStart: 4, fontFamily: "'Varela Round',sans-serif" }}>⬇️ {d.label}</button>
                                  ))}
                                  {/* Per-item status */}
                                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                                    <div style={{ color: COLORS.gray, fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span>{lang === "he" ? "שלב הפריט" : lang === "ru" ? "Этап" : "Item stage"}</span>
                                      {(() => {
                                        const cur = ORDER_STAGES.find(s => s.key === it.status) || ORDER_STAGES[0];
                                        return <span style={{ color: statusColors[it.status] || COLORS.accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: cur.dot }}></span>{cur[lang] || cur.en}</span>;
                                      })()}
                                    </div>
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {ORDER_STAGES.map(s => (
                                        <button key={s.key} onClick={() => updateStatus(it.id, s.key, it.created_at, false)} title={s[lang] || s.en} style={{ background: it.status === s.key ? statusColors[s.key] : COLORS.bgCard, border: `1px solid ${it.status === s.key ? statusColors[s.key] : COLORS.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", flex: "1 1 auto", minWidth: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                          <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: s.dot, boxShadow: it.status === s.key ? `0 0 6px ${s.dot}` : "none" }}></span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>
                              {isMulti ? (lang === "he" ? "עדכן סטטוס לכל הפריטים" : lang === "ru" ? "Обновить статус всех" : "Update all items status") : t.admin.updateStatus}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {ORDER_STAGES.map(s => (
                                <button key={s.key} onClick={() => { group.forEach((o, idx) => updateStatus(o.id, s.key, o.created_at, idx === 0)); }} style={{ background: order.status === s.key ? statusColors[s.key] : COLORS.bg, border: `1px solid ${order.status === s.key ? statusColors[s.key] : COLORS.border}`, color: order.status === s.key ? "#000" : COLORS.gray, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: order.status === s.key ? "#000" : s.dot }}></span>
                                  {s[lang] || s.en}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })})()}
            </div>
          )
        }

        {/* ===== BLOOM catalog manager — full CRUD for pet_designs ===== */}
        <div id="admin-pets" style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, marginBottom: 20, flexWrap: `wrap`, gap: 10 }}>
            <div>
              <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>BLOOM</h2>
              <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>
                {petsLoading
                  ? (lang === "he" ? "טוען..." : lang === "ru" ? "Загрузка..." : "Loading...")
                  : `${petDesigns.length} ${lang === "he" ? "דמויות" : lang === "ru" ? "персонажей" : "characters"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setAddingDesign(true); setEditingDesignId(null); setDesignForm(BLANK_DESIGN); }}
              style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 8, padding: `10px 16px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>
              {lang === `he` ? `+ הוסף דמות` : lang === `ru` ? `+ Добавить персонажа` : `+ Add character`}
            </button>
          </div>

          {addingDesign && (
            <DesignEditor
              form={designForm}
              setForm={setDesignForm}
              busy={catalogBusy}
              onSave={() => savePetDesign(designForm, null)}
              onCancel={() => { setAddingDesign(false); setDesignForm(BLANK_DESIGN); }}
              onDelete={null}
              uploadAdminImage={uploadAdminImage}
              lang={lang}
            />
          )}

          {!petsLoading && petDesigns.length === 0 && !addingDesign && (
            <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.gray, fontSize: 14 }}>
              {lang === "he" ? "אין דמויות עדיין" : lang === "ru" ? "Персонажей пока нет" : "No characters yet"}
            </div>
          )}

          {petDesigns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {petDesigns.map((d) => {
                const dName = d[`name_${lang}`] || d.name_en || d.name_he || "—";
                const thumb = d.mockup_shirt_url || d.mockup_url || d.design_url;
                const isEditing = editingDesignId === d.id;
                return (
                  <div key={d.id}>
                    <div style={{ background: COLORS.bgCard, border: `1px solid ${isEditing ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: d.mockup_bg || COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {thumb && <SmartImage src={thumb} alt={dName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ color: COLORS.white, fontWeight: 600, fontFamily: "'Playfair Display',serif" }}>{dName}</div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>
                          {[d.species, d.breed_en || d.breed_he, d.is_active ? `` : (lang === `he` ? `כבוי` : lang === `ru` ? `выкл` : `inactive`)].filter(Boolean).join(` · `)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => togglePetFlag(d.id, "is_bestseller", !d.is_bestseller)}
                          aria-pressed={!!d.is_bestseller}
                          style={{
                            background: d.is_bestseller ? COLORS.accent : "transparent",
                            border: `1px solid ${d.is_bestseller ? COLORS.accent : COLORS.border}`,
                            color: d.is_bestseller ? "#fff" : COLORS.gray,
                            borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                            fontFamily: "'Varela Round',sans-serif", fontSize: 12, fontWeight: 700,
                            transition: "all 0.2s",
                          }}>{t.badges.bestseller}</button>
                        <button onClick={() => togglePetFlag(d.id, "is_new", !d.is_new)}
                          aria-pressed={!!d.is_new}
                          style={{
                            background: d.is_new ? COLORS.accent : "transparent",
                            border: `1px solid ${d.is_new ? COLORS.accent : COLORS.border}`,
                            color: d.is_new ? "#fff" : COLORS.gray,
                            borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                            fontFamily: "'Varela Round',sans-serif", fontSize: 12, fontWeight: 700,
                            transition: "all 0.2s",
                          }}>{t.badges.new}</button>
                        <button
                          onClick={() => {
                            if (isEditing) { setEditingDesignId(null); return; }
                            setEditingDesignId(d.id);
                            setAddingDesign(false);
                            setDesignForm({ ...BLANK_DESIGN, ...d, breed_aliases: d.breed_aliases || `` });
                          }}
                          style={{ background: isEditing ? COLORS.accent : `transparent`, color: isEditing ? `#fff` : COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: `6px 12px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>
                          {isEditing ? (lang === `he` ? `סגור` : lang === `ru` ? `Закрыть` : `Close`) : (lang === `he` ? `ערוך` : lang === `ru` ? `Изменить` : `Edit`)}
                        </button>
                      </div>
                    </div>
                    {isEditing && (
                      <DesignEditor
                        form={designForm}
                        setForm={setDesignForm}
                        busy={catalogBusy}
                        onSave={() => savePetDesign(designForm, d.id)}
                        onCancel={() => setEditingDesignId(null)}
                        onDelete={() => deletePetDesign(d.id)}
                        uploadAdminImage={uploadAdminImage}
                        lang={lang}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== Sticker packs catalog manager — full CRUD for sticker_packs ===== */}
        <div id="admin-packs" style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, marginBottom: 20, flexWrap: `wrap`, gap: 10 }}>
            <div>
              <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>
                {lang === `he` ? `חבילות מדבקות` : lang === `ru` ? `Наборы наклеек` : `Sticker packs`}
              </h2>
              <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>
                {packsLoading
                  ? (lang === `he` ? `טוען...` : lang === `ru` ? `Загрузка...` : `Loading...`)
                  : `${stickerPacks.length} ${lang === `he` ? `חבילות` : lang === `ru` ? `наборов` : `packs`}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setAddingPack(true); setEditingPackId(null); setPackForm(BLANK_PACK); }}
              style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 8, padding: `10px 16px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>
              {lang === `he` ? `+ הוסף חבילה` : lang === `ru` ? `+ Добавить набор` : `+ Add pack`}
            </button>
          </div>

          {addingPack && (
            <PackEditor
              form={packForm}
              setForm={setPackForm}
              busy={catalogBusy}
              onSave={() => saveStickerPack(packForm, null)}
              onCancel={() => { setAddingPack(false); setPackForm(BLANK_PACK); }}
              onDelete={null}
              uploadAdminImage={uploadAdminImage}
              lang={lang}
            />
          )}

          {!packsLoading && stickerPacks.length === 0 && !addingPack && (
            <div style={{ textAlign: `center`, padding: `32px 0`, color: COLORS.gray, fontSize: 14 }}>
              {lang === `he` ? `אין חבילות עדיין` : lang === `ru` ? `Наборов пока нет` : `No packs yet`}
            </div>
          )}

          {stickerPacks.length > 0 && (
            <div style={{ display: `flex`, flexDirection: `column`, gap: 8 }}>
              {stickerPacks.map((p) => {
                const pName = p[`name_${lang}`] || p.name_en || p.name_he || `—`;
                const isEditing = editingPackId === p.id;
                return (
                  <div key={p.id}>
                    <div style={{ background: COLORS.bgCard, border: `1px solid ${isEditing ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: `10px 14px`, display: `flex`, alignItems: `center`, gap: 14, flexWrap: `wrap` }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: COLORS.bg, display: `flex`, alignItems: `center`, justifyContent: `center`, overflow: `hidden`, flexShrink: 0 }}>
                        {p.image_url && <SmartImage src={p.image_url} alt={pName} style={{ width: `100%`, height: `100%`, objectFit: `contain` }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ color: COLORS.white, fontWeight: 600, fontFamily: `'Playfair Display',serif` }}>{pName}</div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>
                          {[p.species, `₪${p.price}`, `${(p.item_slugs || []).length} ${lang === `he` ? `מדבקות` : lang === `ru` ? `наклеек` : `stickers`}`, p.is_active ? `` : (lang === `he` ? `כבוי` : lang === `ru` ? `выкл` : `inactive`)].filter(Boolean).join(` · `)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isEditing) { setEditingPackId(null); return; }
                          setEditingPackId(p.id);
                          setAddingPack(false);
                          setPackForm({ ...BLANK_PACK, ...p, item_slugs: (p.item_slugs || []).join(`, `) });
                        }}
                        style={{ background: isEditing ? COLORS.accent : `transparent`, color: isEditing ? `#fff` : COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: `6px 12px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>
                        {isEditing ? (lang === `he` ? `סגור` : lang === `ru` ? `Закрыть` : `Close`) : (lang === `he` ? `ערוך` : lang === `ru` ? `Изменить` : `Edit`)}
                      </button>
                    </div>
                    {isEditing && (
                      <PackEditor
                        form={packForm}
                        setForm={setPackForm}
                        busy={catalogBusy}
                        onSave={() => saveStickerPack(packForm, p.id)}
                        onCancel={() => setEditingPackId(null)}
                        onDelete={() => deleteStickerPack(p.id)}
                        uploadAdminImage={uploadAdminImage}
                        lang={lang}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== Blog manager — full CRUD for blog_posts (Slice 2) ===== */}
        <div id="admin-blog">
          <BlogAdmin uploadAdminImage={uploadAdminImage} lang={lang} />
        </div>

        {/* ===== Pending design-approval queue — custom uploads awaiting review ===== */}
        <div id="admin-approvals" style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>
              {lang === `he` ? `אישור עיצובים` : lang === `ru` ? `Одобрение дизайнов` : `Pending design approval`}
            </h2>
            <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>
              {loading
                ? (lang === `he` ? `טוען...` : lang === `ru` ? `Загрузка...` : `Loading...`)
                : `${pendingApprovals.length} ${lang === `he` ? `ממתינים לאישור` : lang === `ru` ? `ожидают одобрения` : `awaiting review`}`}
            </p>
          </div>

          {!loading && pendingApprovals.length === 0 && (
            <div style={{ textAlign: `center`, padding: `32px 0`, color: COLORS.gray, fontSize: 14 }}>
              {lang === `he` ? `אין עיצובים שממתינים לאישור 🎉` : lang === `ru` ? `Нет дизайнов на проверке 🎉` : `No designs awaiting approval 🎉`}
            </div>
          )}

          {!loading && pendingApprovals.length > 0 && (
            <div style={{ display: `flex`, flexDirection: `column`, gap: 14 }}>
              {pendingApprovals.map(o => (
                <div key={o.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, display: `flex`, gap: 16, flexWrap: `wrap`, alignItems: `flex-start` }}>
                  {/* Design + mockup thumbnails */}
                  <div style={{ display: `flex`, gap: 10, flexShrink: 0 }}>
                    {o.design_url && (
                      <div>
                        <div style={{ color: COLORS.gray, fontSize: 10, fontWeight: 600, textTransform: `uppercase`, marginBottom: 4 }}>{lang === `he` ? `העיצוב` : lang === `ru` ? `Дизайн` : `Design`}</div>
                        <a href={o.design_url} target="_blank" rel="noreferrer" style={{ display: `block`, width: 110, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 6 }}>
                          <SmartImage src={o.design_url} alt="Uploaded design" style={{ width: `100%`, display: `block`, borderRadius: 4 }} />
                        </a>
                      </div>
                    )}
                    {o.mockup_url && o.mockup_url !== o.design_url && (
                      <div>
                        <div style={{ color: COLORS.gray, fontSize: 10, fontWeight: 600, textTransform: `uppercase`, marginBottom: 4 }}>{lang === `he` ? `תצוגה` : lang === `ru` ? `Превью` : `Mockup`}</div>
                        <div style={{ width: 110, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 6 }}>
                          <SmartImage src={o.mockup_url} alt="Order mockup" style={{ width: `100%`, display: `block`, borderRadius: 4 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Order info + actions */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 15 }}>{o.customer_name}</div>
                    <div style={{ color: COLORS.gray, fontSize: 12, wordBreak: `break-all` }}>{o.customer_email}{o.customer_phone ? ` · ${o.customer_phone}` : ``}</div>
                    <div style={{ color: COLORS.white, fontSize: 13, marginTop: 8 }}>{localizeProduct(o.product, lang)} · {localizeVariant(o.variant, lang)} × {o.quantity} · <span style={{ color: COLORS.accent, fontWeight: 700 }}>₪{o.total}</span></div>
                    <AdminPetNameBlock order={o} lang={lang} />
                    {o.notes && <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 6, background: COLORS.bg, padding: `7px 10px`, borderRadius: 6 }}>{o.notes}</div>}
                    <div style={{ color: COLORS.grayLight, fontSize: 11, marginTop: 6 }}>{wlDate(o.created_at)} · {timeAgo(o.created_at, lang)}</div>
                    <div style={{ display: `flex`, gap: 10, marginTop: 12, flexWrap: `wrap` }}>
                      <button onClick={() => reviewDesign(o.id, `approved`)} style={{ background: COLORS.success, color: `#0f0f0f`, border: `none`, borderRadius: 8, padding: `10px 20px`, fontSize: 13.5, fontWeight: 700, cursor: `pointer`, fontFamily: "'Varela Round',sans-serif" }}>
                        ✓ {lang === `he` ? `אשר` : lang === `ru` ? `Одобрить` : `Approve`}
                      </button>
                      <button onClick={() => reviewDesign(o.id, `rejected`)} style={{ background: `transparent`, color: `#f87171`, border: `1px solid rgba(248,113,113,0.5)`, borderRadius: 8, padding: `10px 20px`, fontSize: 13.5, fontWeight: 700, cursor: `pointer`, fontFamily: "'Varela Round',sans-serif" }}>
                        ✎ {lang === `he` ? `בקש שינויים` : lang === `ru` ? `Запросить изменения` : `Request changes`}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Waitlist dashboard (read-only) — Task 10 ===== */}
        <div id="admin-waitlist" style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>
              {lang === `he` ? `רשימת המתנה` : lang === `ru` ? `Лист ожидания` : `Waitlist`}
            </h2>
            <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>
              {waitlistLoading
                ? (lang === `he` ? `טוען...` : lang === `ru` ? `Загрузка...` : `Loading...`)
                : `${waitlist.length} ${lang === `he` ? `נרשמו` : lang === `ru` ? `записей` : `signups`}`}
            </p>
          </div>

          {!waitlistLoading && waitlist.length === 0 && (
            <div style={{ textAlign: `center`, padding: `32px 0`, color: COLORS.gray, fontSize: 14 }}>
              {lang === `he` ? `עדיין אין נרשמים` : lang === `ru` ? `Пока нет записей` : `No signups yet`}
            </div>
          )}

          {!waitlistLoading && waitlist.length > 0 && (
            <>
              {/* Most-requested breeds */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 700, textTransform: `uppercase`, letterSpacing: `0.12em`, marginBottom: 12 }}>
                  {lang === `he` ? `הגזעים המבוקשים ביותר` : lang === `ru` ? `Самые востребованные породы` : `Most-requested breeds`}
                </div>
                {wlTopBreeds.length === 0 ? (
                  <div style={{ color: COLORS.gray, fontSize: 13 }}>
                    {lang === `he` ? `אין עדיין עניין בגזע מסוים` : lang === `ru` ? `Пока нет интереса к породам` : `No breed interest yet`}
                  </div>
                ) : (
                  <div style={{ display: `flex`, flexWrap: `wrap`, gap: 8 }}>
                    {wlTopBreeds.map(([slug, count]) => (
                      <div key={slug} style={{ display: `inline-flex`, alignItems: `center`, gap: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: `7px 14px` }}>
                        <span style={{ color: COLORS.white, fontSize: 13, fontWeight: 600 }}>{wlBreedLabel(slug)}</span>
                        <span style={{ background: COLORS.accentBtn, color: `#fff`, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: `1px 8px` }}>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent signups */}
              <div>
                <div style={{ color: COLORS.accent, fontSize: 11, fontWeight: 700, textTransform: `uppercase`, letterSpacing: `0.12em`, marginBottom: 12 }}>
                  {lang === `he` ? `הרשמות אחרונות` : lang === `ru` ? `Недавние записи` : `Recent signups`}
                </div>
                <div style={{ display: `flex`, flexDirection: `column`, gap: 8 }}>
                  {wlRecent.map((r, i) => (
                    <div key={i} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: `10px 14px`, display: `flex`, alignItems: `center`, gap: 12, flexWrap: `wrap` }}>
                      <span style={{ color: COLORS.white, fontSize: 13, fontWeight: 600, flex: 1, minWidth: 180, wordBreak: `break-all` }}>{r.email}</span>
                      <span style={{ color: COLORS.gray, fontSize: 11, textTransform: `uppercase`, letterSpacing: `0.06em` }}>{(r.lang || `he`).toUpperCase()}</span>
                      <span style={{ color: COLORS.gray, fontSize: 11 }}>{wlSourceLabel(r.source)}</span>
                      <span style={{ color: COLORS.gray, fontSize: 11 }}>{wlDate(r.created_at)} · {timeAgo(r.created_at, lang)}</span>
                    </div>
                  ))}
                </div>
                {waitlist.length > wlRecent.length && (
                  <div style={{ color: COLORS.grayLight, fontSize: 11, marginTop: 10, textAlign: `center` }}>
                    {lang === `he` ? `מציג ${wlRecent.length} מתוך ${waitlist.length}` : lang === `ru` ? `Показаны ${wlRecent.length} из ${waitlist.length}` : `Showing ${wlRecent.length} of ${waitlist.length}`}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Admin catalog: shared field helpers and editor components ============
// Both editors share the same input style + label pattern. The form components
// take the form state by ref (form + setForm) so the parent (AdminPage) keeps
// ownership and can flush it to Supabase on Save. Image rows accept either a
// pasted URL or a file picker that uploads into the named Storage bucket.

function AdminFieldLabel({ children }) {
  return <label style={{ display: `block`, color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: `uppercase`, letterSpacing: `0.08em`, marginBottom: 6 }}>{children}</label>;
}

function AdminInput({ value, onChange, type, placeholder, disabled, dir }) {
  return <input
    type={type || `text`}
    value={value ?? ``}
    onChange={(e) => onChange(type === `number` ? e.target.value : e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    dir={dir}
    style={{ width: `100%`, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: `8px 10px`, fontSize: 13, fontFamily: `'Varela Round',sans-serif`, boxSizing: `border-box`, outline: `none` }}
    onFocus={(e) => { e.target.style.borderColor = COLORS.accent; }}
    onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
  />;
}

function AdminImageRow({ label, value, onChange, bucket, prefix, uploadAdminImage, busy }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadAdminImage(bucket, f, prefix);
      if (url) onChange(url);
    } catch (err) {
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = ``;
    }
  };
  return (
    <div>
      <AdminFieldLabel>{label}</AdminFieldLabel>
      <div style={{ display: `flex`, gap: 8, alignItems: `center`, flexWrap: `wrap` }}>
        <input
          type="text"
          value={value || ``}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          dir="ltr"
          style={{ flex: 1, minWidth: 200, background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: `8px 10px`, fontSize: 12, fontFamily: `monospace`, boxSizing: `border-box`, outline: `none` }}
          onFocus={(e) => { e.target.style.borderColor = COLORS.accent; }}
          onBlur={(e) => { e.target.style.borderColor = COLORS.border; }}
        />
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: `none` }} />
        <button type="button" disabled={busy || uploading} onClick={() => fileRef.current?.click()} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: `8px 12px`, fontSize: 12, fontWeight: 700, cursor: busy || uploading ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, whiteSpace: `nowrap` }}>
          {uploading ? `…` : `Upload`}
        </button>
        {value && <img src={value} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: `cover`, border: `1px solid ${COLORS.border}` }} />}
      </div>
    </div>
  );
}

function DesignEditor({ form, setForm, busy, onSave, onCancel, onDelete, uploadAdminImage, lang }) {
  const set = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));
  const labels = {
    he: { slug: `מזהה (slug)`, names: `שמות`, animal: `סוג חיה`, tagline: `סלוגן`, species: `מין`, dog: `כלב`, cat: `חתול`, breed: `גזע`, aliases: `שמות נוספים לחיפוש (מופרדים בפסיק)`, prices: `מחירים`, images: `תמונות`, mockupHero: `תמונה ראשית (mockup_url)`, mockupShirt: `חולצה (mockup_shirt_url)`, mockupMug: `ספל (mockup_mug_url)`, design: `עיצוב נקי (design_url)`, bg: `רקע (mockup_bg)`, sort: `סדר`, active: `פעיל`, save: `שמור`, cancel: `ביטול`, del: `מחק`, flags: `דגלים`, bestseller: `רב מכר`, fresh: `חדש` },
    en: { slug: `Slug`, names: `Names`, animal: `Animal type`, tagline: `Tagline`, species: `Species`, dog: `Dog`, cat: `Cat`, breed: `Breed`, aliases: `Search aliases (comma separated)`, prices: `Prices`, images: `Images`, mockupHero: `Hero (mockup_url)`, mockupShirt: `Shirt (mockup_shirt_url)`, mockupMug: `Mug (mockup_mug_url)`, design: `Clean design (design_url)`, bg: `Background (mockup_bg)`, sort: `Sort order`, active: `Active`, save: `Save`, cancel: `Cancel`, del: `Delete`, flags: `Flags`, bestseller: `Bestseller`, fresh: `New` },
    ru: { slug: `Slug`, names: `Названия`, animal: `Тип животного`, tagline: `Слоган`, species: `Вид`, dog: `Собака`, cat: `Кошка`, breed: `Порода`, aliases: `Синонимы для поиска (через запятую)`, prices: `Цены`, images: `Изображения`, mockupHero: `Главное (mockup_url)`, mockupShirt: `Футболка (mockup_shirt_url)`, mockupMug: `Кружка (mockup_mug_url)`, design: `Чистый дизайн (design_url)`, bg: `Фон (mockup_bg)`, sort: `Порядок`, active: `Активен`, save: `Сохранить`, cancel: `Отмена`, del: `Удалить`, flags: `Метки`, bestseller: `Хит`, fresh: `Новинка` },
  };
  const L = labels[lang] || labels.he;
  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 10, padding: 18, marginTop: 10, marginBottom: 10, display: `flex`, flexDirection: `column`, gap: 14 }}>
      <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 12 }}>
        <div><AdminFieldLabel>{L.slug}</AdminFieldLabel><AdminInput value={form.slug} onChange={set(`slug`)} placeholder="01_corgi" dir="ltr" /></div>
        <div><AdminFieldLabel>{L.species}</AdminFieldLabel>
          <div style={{ display: `flex`, gap: 8 }}>
            {[`dog`, `cat`].map(sp => (
              <button key={sp} type="button" onClick={() => set(`species`)(sp)} style={{ flex: 1, background: form.species === sp ? COLORS.accent : `transparent`, color: form.species === sp ? `#fff` : COLORS.gray, border: `1px solid ${form.species === sp ? COLORS.accent : COLORS.border}`, borderRadius: 6, padding: `8px 10px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>{sp === `dog` ? L.dog : L.cat}</button>
            ))}
          </div>
        </div>
        <div><AdminFieldLabel>{L.sort}</AdminFieldLabel><AdminInput type="number" value={form.sort_order} onChange={set(`sort_order`)} /></div>
      </div>
      <div>
        <AdminFieldLabel>{L.names}</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 8 }}>
          <AdminInput value={form.name_he} onChange={set(`name_he`)} placeholder="עברית" dir="rtl" />
          <AdminInput value={form.name_en} onChange={set(`name_en`)} placeholder="English" dir="ltr" />
          <AdminInput value={form.name_ru} onChange={set(`name_ru`)} placeholder="Русский" dir="ltr" />
        </div>
      </div>
      <div>
        <AdminFieldLabel>{L.breed}</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 8 }}>
          <AdminInput value={form.breed_he} onChange={set(`breed_he`)} placeholder="עברית" dir="rtl" />
          <AdminInput value={form.breed_en} onChange={set(`breed_en`)} placeholder="English" dir="ltr" />
          <AdminInput value={form.breed_ru} onChange={set(`breed_ru`)} placeholder="Русский" dir="ltr" />
        </div>
        <div style={{ marginTop: 8 }}>
          <AdminFieldLabel>{L.aliases}</AdminFieldLabel>
          <AdminInput value={form.breed_aliases} onChange={set(`breed_aliases`)} placeholder="corgi, קורגי, корги" dir="ltr" />
        </div>
      </div>
      <div>
        <AdminFieldLabel>{L.animal}</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 8 }}>
          <AdminInput value={form.animal_he} onChange={set(`animal_he`)} placeholder="עברית" dir="rtl" />
          <AdminInput value={form.animal_en} onChange={set(`animal_en`)} placeholder="English" dir="ltr" />
          <AdminInput value={form.animal_ru} onChange={set(`animal_ru`)} placeholder="Русский" dir="ltr" />
        </div>
      </div>
      <div>
        <AdminFieldLabel>{L.tagline}</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 8 }}>
          <AdminInput value={form.tagline_he} onChange={set(`tagline_he`)} placeholder="עברית" dir="rtl" />
          <AdminInput value={form.tagline_en} onChange={set(`tagline_en`)} placeholder="English" dir="ltr" />
          <AdminInput value={form.tagline_ru} onChange={set(`tagline_ru`)} placeholder="Русский" dir="ltr" />
        </div>
      </div>
      <div>
        <AdminFieldLabel>{L.prices} (₪)</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`, gap: 8 }}>
          <div><AdminFieldLabel>mug</AdminFieldLabel><AdminInput type="number" value={form.price_mug} onChange={set(`price_mug`)} /></div>
          <div><AdminFieldLabel>shirt basic</AdminFieldLabel><AdminInput type="number" value={form.price_shirt_basic} onChange={set(`price_shirt_basic`)} /></div>
          <div><AdminFieldLabel>shirt oversized</AdminFieldLabel><AdminInput type="number" value={form.price_shirt_oversized} onChange={set(`price_shirt_oversized`)} /></div>
          <div><AdminFieldLabel>sticker pack</AdminFieldLabel><AdminInput type="number" value={form.price_sticker_pack} onChange={set(`price_sticker_pack`)} /></div>
          <div><AdminFieldLabel>legacy shirt</AdminFieldLabel><AdminInput type="number" value={form.price_shirt} onChange={set(`price_shirt`)} /></div>
          <div><AdminFieldLabel>legacy sticker</AdminFieldLabel><AdminInput type="number" value={form.price_sticker} onChange={set(`price_sticker`)} /></div>
        </div>
      </div>
      <div style={{ display: `flex`, flexDirection: `column`, gap: 10 }}>
        <AdminFieldLabel>{L.images}</AdminFieldLabel>
        <AdminImageRow label={L.mockupHero} value={form.mockup_url} onChange={set(`mockup_url`)} bucket="mockups" prefix="bloom-hero" uploadAdminImage={uploadAdminImage} busy={busy} />
        <AdminImageRow label={L.mockupShirt} value={form.mockup_shirt_url} onChange={set(`mockup_shirt_url`)} bucket="mockups" prefix="bloom-shirt" uploadAdminImage={uploadAdminImage} busy={busy} />
        <AdminImageRow label={L.mockupMug} value={form.mockup_mug_url} onChange={set(`mockup_mug_url`)} bucket="mockups" prefix="bloom-mug" uploadAdminImage={uploadAdminImage} busy={busy} />
        <AdminImageRow label={L.design} value={form.design_url} onChange={set(`design_url`)} bucket="designs" prefix="bloom-design" uploadAdminImage={uploadAdminImage} busy={busy} />
        <div><AdminFieldLabel>{L.bg}</AdminFieldLabel><AdminInput value={form.mockup_bg} onChange={set(`mockup_bg`)} placeholder="#0d0d0d" dir="ltr" /></div>
      </div>
      <div>
        <AdminFieldLabel>{L.flags}</AdminFieldLabel>
        <div style={{ display: `flex`, gap: 16, flexWrap: `wrap` }}>
          <label style={{ display: `inline-flex`, alignItems: `center`, gap: 8, color: COLORS.white, fontSize: 13, fontFamily: `'Varela Round',sans-serif` }}>
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => set(`is_active`)(e.target.checked)} />
            {L.active}
          </label>
          <label style={{ display: `inline-flex`, alignItems: `center`, gap: 8, color: COLORS.white, fontSize: 13, fontFamily: `'Varela Round',sans-serif` }}>
            <input type="checkbox" checked={!!form.is_bestseller} onChange={(e) => set(`is_bestseller`)(e.target.checked)} />
            {L.bestseller}
          </label>
          <label style={{ display: `inline-flex`, alignItems: `center`, gap: 8, color: COLORS.white, fontSize: 13, fontFamily: `'Varela Round',sans-serif` }}>
            <input type="checkbox" checked={!!form.is_new} onChange={(e) => set(`is_new`)(e.target.checked)} />
            {L.fresh}
          </label>
        </div>
      </div>
      <div style={{ display: `flex`, gap: 8, flexWrap: `wrap`, justifyContent: `space-between` }}>
        <div style={{ display: `flex`, gap: 8 }}>
          <button type="button" disabled={busy} onClick={onSave} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 6, padding: `10px 18px`, fontWeight: 700, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.save}</button>
          <button type="button" disabled={busy} onClick={onCancel} style={{ background: `transparent`, color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: `10px 18px`, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.cancel}</button>
        </div>
        {onDelete && <button type="button" disabled={busy} onClick={onDelete} style={{ background: `transparent`, color: `#f87171`, border: `1px solid #f87171`, borderRadius: 6, padding: `10px 18px`, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.del}</button>}
      </div>
    </div>
  );
}

function PackEditor({ form, setForm, busy, onSave, onCancel, onDelete, uploadAdminImage, lang }) {
  const set = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));
  const L = {
    he: { slug: `מזהה (slug)`, names: `שמות`, species: `מין`, dog: `כלב`, cat: `חתול`, mixed: `מעורב`, price: `מחיר (₪)`, image: `תמונה`, items: `מדבקות בחבילה (slugs מופרדים בפסיק)`, sort: `סדר`, active: `פעיל`, save: `שמור`, cancel: `ביטול`, del: `מחק` },
    en: { slug: `Slug`, names: `Names`, species: `Species`, dog: `Dog`, cat: `Cat`, mixed: `Mixed`, price: `Price (₪)`, image: `Image`, items: `Stickers in pack (comma-separated slugs)`, sort: `Sort order`, active: `Active`, save: `Save`, cancel: `Cancel`, del: `Delete` },
    ru: { slug: `Slug`, names: `Названия`, species: `Вид`, dog: `Собаки`, cat: `Кошки`, mixed: `Смешанный`, price: `Цена (₪)`, image: `Изображение`, items: `Наклейки в наборе (slug через запятую)`, sort: `Порядок`, active: `Активен`, save: `Сохранить`, cancel: `Отмена`, del: `Удалить` },
  }[lang] || {};
  return (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.accent}`, borderRadius: 10, padding: 18, marginTop: 10, marginBottom: 10, display: `flex`, flexDirection: `column`, gap: 14 }}>
      <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 12 }}>
        <div><AdminFieldLabel>{L.slug}</AdminFieldLabel><AdminInput value={form.slug} onChange={set(`slug`)} placeholder="dogs_pack_top10" dir="ltr" /></div>
        <div><AdminFieldLabel>{L.species}</AdminFieldLabel>
          <div style={{ display: `flex`, gap: 6 }}>
            {[[`dog`, L.dog], [`cat`, L.cat], [`mixed`, L.mixed]].map(([sp, lab]) => (
              <button key={sp} type="button" onClick={() => set(`species`)(sp)} style={{ flex: 1, background: form.species === sp ? COLORS.accent : `transparent`, color: form.species === sp ? `#fff` : COLORS.gray, border: `1px solid ${form.species === sp ? COLORS.accent : COLORS.border}`, borderRadius: 6, padding: `8px 6px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>{lab}</button>
            ))}
          </div>
        </div>
        <div><AdminFieldLabel>{L.price}</AdminFieldLabel><AdminInput type="number" value={form.price} onChange={set(`price`)} /></div>
        <div><AdminFieldLabel>{L.sort}</AdminFieldLabel><AdminInput type="number" value={form.sort_order} onChange={set(`sort_order`)} /></div>
      </div>
      <div>
        <AdminFieldLabel>{L.names}</AdminFieldLabel>
        <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 8 }}>
          <AdminInput value={form.name_he} onChange={set(`name_he`)} placeholder="עברית" dir="rtl" />
          <AdminInput value={form.name_en} onChange={set(`name_en`)} placeholder="English" dir="ltr" />
          <AdminInput value={form.name_ru} onChange={set(`name_ru`)} placeholder="Русский" dir="ltr" />
        </div>
      </div>
      <AdminImageRow label={L.image} value={form.image_url} onChange={set(`image_url`)} bucket="mockups" prefix="pack" uploadAdminImage={uploadAdminImage} busy={busy} />
      <div>
        <AdminFieldLabel>{L.items}</AdminFieldLabel>
        <AdminInput value={form.item_slugs} onChange={set(`item_slugs`)} placeholder="01_golden_retriever, 09_labrador, ..." dir="ltr" />
      </div>
      <label style={{ display: `inline-flex`, alignItems: `center`, gap: 8, color: COLORS.white, fontSize: 13, fontFamily: `'Varela Round',sans-serif` }}>
        <input type="checkbox" checked={!!form.is_active} onChange={(e) => set(`is_active`)(e.target.checked)} />
        {L.active}
      </label>
      <div style={{ display: `flex`, gap: 8, flexWrap: `wrap`, justifyContent: `space-between` }}>
        <div style={{ display: `flex`, gap: 8 }}>
          <button type="button" disabled={busy} onClick={onSave} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 6, padding: `10px 18px`, fontWeight: 700, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.save}</button>
          <button type="button" disabled={busy} onClick={onCancel} style={{ background: `transparent`, color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: `10px 18px`, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.cancel}</button>
        </div>
        {onDelete && <button type="button" disabled={busy} onClick={onDelete} style={{ background: `transparent`, color: `#f87171`, border: `1px solid #f87171`, borderRadius: 6, padding: `10px 18px`, cursor: busy ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>{L.del}</button>}
      </div>
    </div>
  );
}

// Order Page
// ============ ORDER SUMMARY — sticky sidebar on desktop, collapsible top bar on mobile ============
// Lives inside step 3 of the OrderPage so the customer always sees what
// they're about to pay for, with inline qty/remove controls.
function OrderSummary({ lang, cart, setCart, updateCartQty, isMobile, shippingPrice }) {
  const isRTL = lang === "he";
  // Falls back to the legacy flat rate if the parent hasn't passed a chosen
  // method yet (defensive — every OrderPage caller now provides it).
  const effectiveShipping = Number.isFinite(shippingPrice) ? shippingPrice : SHIPPING_PRICE;
  const TR = {
    he: { title: "ההזמנה שלך", items: "פריטים", subtotal: "סכום ביניים", shipping: "משלוח", free: "חינם", total: "סה״כ", empty: "הסל ריק", expand: "הצג סיכום", collapse: "הסתר סיכום", inc: "הוסף", dec: "הפחת", remove: "הסר" },
    en: { title: "Your order", items: "items", subtotal: "Subtotal", shipping: "Shipping", free: "Free", total: "Total", empty: "Cart is empty", expand: "Show summary", collapse: "Hide summary", inc: "Increase", dec: "Decrease", remove: "Remove" },
    ru: { title: "Ваш заказ", items: "товаров", subtotal: "Подытог", shipping: "Доставка", free: "Бесплатно", total: "Итого", empty: "Корзина пуста", expand: "Показать", collapse: "Скрыть", inc: "Увеличить", dec: "Уменьшить", remove: "Удалить" },
  };
  const tr = TR[lang] || TR.he;

  // Mobile starts collapsed so the form stays the first thing in the viewport.
  const [open, setOpen] = useState(!isMobile);

  // Inline qty updater — falls back to a local impl if the parent didn't pass one.
  const setQty = updateCartQty || ((id, q) => {
    if (q < 1) { setCart(c => c.filter(it => it.id !== id)); return; }
    setCart(c => c.map(it => {
      if (it.id !== id) return it;
      const unit = Number(it.unitPrice ?? it.itemPrice / Math.max(1, it.qty || 1)) || 0;
      return { ...it, qty: q, unitPrice: unit, itemPrice: unit * q };
    }));
  });

  const subtotal = cart.reduce((s, it) => s + (Number(it.itemPrice) || 0), 0);
  const itemCount = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const shipping = cart.length > 0 ? effectiveShipping : 0;
  const total = subtotal + shipping;

  const qtyBtnStyle = {
    width: isMobile ? 36 : 28,
    height: isMobile ? 36 : 28,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg,
    color: COLORS.white,
    cursor: "pointer",
    fontSize: isMobile ? 18 : 14,
    lineHeight: 1,
    fontFamily: "'Varela Round',sans-serif",
    fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    touchAction: "manipulation",
    transition: "border-color 0.15s, color 0.15s",
  };

  const itemRow = (it) => {
    const qty = Number(it.qty) || 1;
    const unit = Number(it.unitPrice ?? it.itemPrice / Math.max(1, qty)) || 0;
    return (
      <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: COLORS.bg, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <SmartImage src={it.mockupUrl || it.uploadedImage || MOCKUP_URLS[it.productId]} alt={it.productName} style={{ width: "100%", height: "100%", objectFit: it.mockupUrl ? "cover" : "contain" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{it.productName}</div>
          {it.petName && <div style={{ color: it.petNameColor || COLORS.accent, fontFamily: `'${it.petNameFont || PET_NAME_FONT_DEFAULT}', sans-serif`, fontSize: 13, fontWeight: 700, marginTop: 3 }} dir={hasHebrew(it.petName) ? `rtl` : `ltr`}>🐾 {it.petName} (+₪{PET_NAME_SURCHARGE})</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: COLORS.gray, fontSize: 11.5, flexWrap: "wrap" }}>
            {it.variantLabel && <span>{it.variantLabel}</span>}
            {it.color && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: "50%", background: it.color, border: "1px solid rgba(255,255,255,0.3)", display: "inline-block", flexShrink: 0 }} />
                <span>{colorName(it.color, lang)}</span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, direction: "ltr" }}>
              <button type="button" aria-label={tr.dec} onClick={() => setQty(it.id, qty - 1)} style={qtyBtnStyle}>−</button>
              <span style={{ minWidth: 22, textAlign: "center", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 14 }}>{qty}</span>
              <button type="button" aria-label={tr.inc} onClick={() => setQty(it.id, qty + 1)} style={qtyBtnStyle}>+</button>
            </div>
            <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 13, fontFamily: "'Varela Round',sans-serif", direction: "ltr" }}>{`₪${unit * qty}`}</span>
          </div>
        </div>
        <button type="button" onClick={() => setCart(c => c.filter(x => x.id !== it.id))} aria-label={tr.remove} style={{
          background: "transparent", border: "none", color: COLORS.gray,
          cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4,
          minWidth: isMobile ? 36 : "auto", minHeight: isMobile ? 36 : "auto",
          flexShrink: 0, transition: "color 0.2s", touchAction: "manipulation",
        }}
        onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
        onMouseOut={e => e.currentTarget.style.color = COLORS.gray}
        >🗑</button>
      </div>
    );
  };

  const breakdown = (
    <div style={{ marginTop: 12, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: COLORS.gray }}>
        <span>{tr.subtotal}</span><span style={{ color: COLORS.white }}>{`₪${subtotal}`}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: COLORS.gray }}>
        <span>{tr.shipping}</span><span style={{ color: COLORS.white }}>{shipping === 0 ? tr.free : `₪${shipping}`}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, color: COLORS.accent, fontWeight: 700, fontSize: 17, fontFamily: "'Playfair Display',serif" }}>
        <span>{tr.total}</span><span>{`₪${total}`}</span>
      </div>
    </div>
  );

  // Mobile bar — collapsible AND sticky just below the fixed Nav (height 72),
  // so the running total stays visible while the form scrolls.
  // zIndex: 50 → above page content, below the Nav (zIndex 100) and toast/drawer.
  if (isMobile) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} style={{
        position: "sticky", top: 72, zIndex: 50,
        background: COLORS.bgCard, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: "14px 16px", marginBottom: 16,
        boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
        // Expanded panel can be long — cap height and let it scroll inside.
        maxHeight: open ? "calc(100vh - 96px)" : "auto",
        overflowY: open ? "auto" : "visible",
      }}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
          background: "transparent", border: "none", color: COLORS.white, cursor: "pointer",
          fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 600, padding: 0,
        }}>
          <span>{`${tr.title} · ${itemCount} ${tr.items}`}</span>
          <span style={{ color: COLORS.accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {`₪${total}`}
            <span style={{ fontSize: 11 }}>{open ? "▲" : "▼"}</span>
          </span>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            {cart.length === 0 ? (
              <div style={{ color: COLORS.gray, fontSize: 13, padding: "12px 0" }}>{tr.empty}</div>
            ) : cart.map(itemRow)}
            {cart.length > 0 && breakdown}
          </div>
        )}
      </div>
    );
  }

  // Desktop sticky sidebar. Requires the parent flex row to use
  // alignItems: flex-start (already set in OrderPage step 3) so the column
  // doesn't stretch to match the form's height — that would defeat sticky.
  // maxHeight + internal scroll keep a long cart from running past the
  // viewport (Nav 72 + breathing room 24 + bottom gap 24 = 120 reserved).
  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{
      position: "sticky", top: 96,
      background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16,
      padding: 20,
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
    }}>
      <h3 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 19, margin: "0 0 14px 0" }}>
        {tr.title}
      </h3>
      {cart.length === 0 ? (
        <div style={{ color: COLORS.gray, fontSize: 13, padding: "8px 0" }}>{tr.empty}</div>
      ) : cart.map(itemRow)}
      {cart.length > 0 && breakdown}
    </div>
  );
}

function OrderPage({ lang, user, setPage, pendingBloomItem, clearPendingBloomItem, cart, setCart, updateCartQty, pendingCheckout, clearPendingCheckout }) {
  const t = LANGS[lang];
  const products = getCustomProducts(t);
  const [step, setStep] = useState((pendingBloomItem || pendingCheckout) ? 3 : 1);
  // Payment-failure return (#order?paid=0) from create-payment's fail redirect.
  // UI-ONLY: surfaces a clear retry path. Safe if visited directly.
  const [payFailed, setPayFailed] = useState(() => {
    if (typeof window === `undefined`) return false;
    const h = rawHash();
    const qi = h.indexOf(`?`);
    if (qi === -1) return false;
    return new URLSearchParams(h.slice(qi + 1)).get(`paid`) === `0`;
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePos, setImagePos] = useState({ x: 150, y: 130, size: 100 });
  const [selectedPlacement, setSelectedPlacement] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [positionLocked, setPositionLocked] = useState(false);
  const [secondPositionLocked, setSecondPositionLocked] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [activeDesign, setActiveDesign] = useState('main');
  const [showPlacement, setShowPlacement] = useState(false);
  // Confirmation-screen optional account offer (guests only)
  const [showAccountOffer, setShowAccountOffer] = useState(true);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSent, setAccountSent] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [form, setForm] = useState({ name: user?.user_metadata?.full_name || "", email: user?.email || "", phonePrefix: "050", phoneNumber: "", street: "", city: "", postalCode: "", notes: "" });
  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [showAddrSugg, setShowAddrSugg] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrTimerRef = useRef();
  const [qty, setQty] = useState(1);
  const [uploadError, setUploadError] = useState(""); // oversized/invalid custom-design upload
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrderGroupId, setPendingOrderGroupId] = useState(null);
  const [pendingOrderIds, setPendingOrderIds] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPaymentSoonModal, setShowPaymentSoonModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({}); // checkout inline validation
  const [submitError, setSubmitError] = useState("");  // friendly inline error (submit/pay)
  // Trilingual checkout validation — required + email/phone/postal format. Returns
  // a {field: message} map; empty = valid. Values stay in `form` so nothing is lost.
  const validateCheckout = () => {
    const req = lang === "he" ? "שדה חובה" : lang === "ru" ? "Обязательное поле" : "Required";
    const e = {};
    if (!form.name.trim()) e.name = req;
    if (!form.email.trim()) e.email = req;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = lang === "he" ? "כתובת אימייל לא תקינה" : lang === "ru" ? "Неверный email" : "Invalid email address";
    if (!form.phoneNumber) e.phone = req;
    else if (form.phoneNumber.length !== 7) e.phone = lang === "he" ? "מספר טלפון לא תקין (7 ספרות)" : lang === "ru" ? "Неверный номер (7 цифр)" : "Invalid phone (7 digits)";
    if (!form.street.trim()) e.street = req;
    if (!form.city.trim()) e.city = req;
    if (!form.postalCode) e.postal = req;
    else if (form.postalCode.length < 5) e.postal = lang === "he" ? "מיקוד לא תקין" : lang === "ru" ? "Неверный индекс" : "Invalid postal code";
    return e;
  };
  const fieldErrStyle = { color: "#f87171", fontSize: 12, marginTop: 4, fontFamily: "'Varela Round',sans-serif" };
  // Custom-upload design approval: when the cart contains an item the customer
  // uploaded their OWN image for, checkout submits the order(s) for review and
  // does NOT start payment (the customer pays later from /track, once approved).
  // BLOOM gallery items + pet-name personalization are unaffected — they pay now.
  const [submittedForApproval, setSubmittedForApproval] = useState(false);
  // A11y: focus-trap + restore for the "payments coming soon" modal.
  const paySoonRef = useDialogFocus(showPaymentSoonModal);
  // Shipping method (Locker / Home). Locker is the cheaper default — most
  // Israeli customers prefer pickup-point delivery. The chosen price feeds
  // into total math + the per-line shipping row in the order insert, and
  // the method itself is stored on each row's extra_prints.shipping_method.
  const [shippingMethod, setShippingMethod] = useState(`locker`);
  const shippingPrice = SHIPPING_RATES[shippingMethod] ?? SHIPPING_LOCKER;
  const [backPrint, setBackPrint] = useState(false);
  const BACK_PRINT_PRICE = 39;
  const SECOND_FRONT_PRICE = 20;
  const SLEEVE_PRICE = 25;
  const [secondFront, setSecondFront] = useState({ enabled: false, image: null, pos: { x: 210, y: 120, size: 43 } });
  const [backDesign, setBackDesign] = useState({ enabled: false, sameAsMain: true, image: null });
  const [sleeveLeft, setSleeveLeft] = useState({ enabled: false, sameAsMain: true, image: null });
  const [sleeveRight, setSleeveRight] = useState({ enabled: false, sameAsMain: true, image: null });
  const secondFileRef = useRef();
  const backFileRef = useRef();
  const sleeveLeftRef = useRef();
  const sleeveRightRef = useRef();
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Below 360px the 5-step labels run out of room and clip; track this
  // separately so we can hide the labels entirely on tiny screens while
  // keeping the numbered circles.
  const [isVeryNarrow, setIsVeryNarrow] = useState(window.innerWidth < 360);
  const fileRef = useRef();
  const mockupRef = useRef();
  const mockupImageRef = useRef();
  const pinchRef = useRef(null);
  // Refs for native touch handlers (needed for passive:false)
  const touchHandlersRef = useRef({});

  useEffect(() => {
    const handle = () => {
      setIsMobile(window.innerWidth < 768);
      setIsVeryNarrow(window.innerWidth < 360);
    };
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Order is already persisted by the time the "payment coming soon" modal
  // appears, so any close path (CTA, ×, Escape, backdrop click) should land
  // the customer on the confirmation step.
  const dismissPaymentSoonModal = () => {
    setShowPaymentSoonModal(false);
    setCart([]);
    setStep(5);
  };
  useEffect(() => {
    if (!showPaymentSoonModal) return;
    const onKey = (e) => { if (e.key === "Escape") dismissPaymentSoonModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPaymentSoonModal]);

  // Escape closes the leave-warning modal as the safe choice (keep ordering),
  // for parity with the CartDrawer/payment modals.
  useEffect(() => {
    if (!leaveWarning) return;
    const onKey = (e) => { if (e.key === "Escape") setLeaveWarning(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaveWarning]);

  // Escape dismisses the payment-failure return overlay (#order?paid=0).
  useEffect(() => {
    if (!payFailed) return;
    const onKey = (e) => { if (e.key === "Escape") setPayFailed(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payFailed]);

  // Non-passive touch listeners — re-attach when step 2 renders (mockupRef becomes available)
  useEffect(() => {
    if (step !== 2) return;
    const el = mockupImageRef.current;
    if (!el) return;
    const onStart = (e) => touchHandlersRef.current.start?.(e);
    const onMove = (e) => { e.preventDefault(); touchHandlersRef.current.move?.(e); };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [step]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (step >= 2 && step < 4) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  const allowLeaveRef = useRef(false);
  const [currentItemCartId, setCurrentItemCartId] = useState(null);
  // showNextChoice opens immediately when arriving with a BLOOM item to add.
  const [showNextChoice, setShowNextChoice] = useState(!!pendingBloomItem);
  // Tracks whether the "added to cart" popup is showing for a BLOOM item
  // (its buttons return to the collection) vs a custom item.
  const [nextChoiceIsBloom, setNextChoiceIsBloom] = useState(!!pendingBloomItem);

  const commitCurrentItem = () => {
    if (!product || !variant || !uploadedImage) return false;
    // Quantity is always 1 at item creation time now — the user adjusts it
    // inside the cart drawer (+/- buttons). unitPrice is the per-item price
    // including extras; itemPrice = unitPrice × qty (recomputed by updateCartQty).
    const unitPrice = variant.price
      + (backPrint ? BACK_PRINT_PRICE : 0)
      + (secondFront.enabled ? SECOND_FRONT_PRICE : 0)
      + (sleeveLeft.enabled ? SLEEVE_PRICE : 0)
      + (sleeveRight.enabled ? SLEEVE_PRICE : 0);
    const colorHex = product.colors[selectedColor];
    const itemData = {
      productId: selectedProduct,
      productName: product.name,
      variantId: selectedVariant,
      variantLabel: variant.label,
      colorIdx: selectedColor,
      color: colorHex,
      qty: 1,
      uploadedImage,
      // mockupUrl is populated asynchronously below — keep any previous value
      // when re-committing the same line so the thumbnail doesn't disappear.
      mockupUrl: null,
      imagePos: { ...imagePos },
      backPrint,
      backDesign: { ...backDesign },
      secondFront: { enabled: secondFront.enabled, image: secondFront.image, sameAsMain: secondFront.sameAsMain, pos: { ...secondFront.pos } },
      sleeveLeft: { ...sleeveLeft },
      sleeveRight: { ...sleeveRight },
      unitPrice,
      itemPrice: unitPrice,
    };
    let cartItemId = currentItemCartId;
    if (currentItemCartId) {
      setCart(c => c.map(it => it.id === currentItemCartId ? { ...it, ...itemData, mockupUrl: it.mockupUrl || null } : it));
    } else {
      cartItemId = Date.now() + Math.random();
      setCart(c => [...c, { id: cartItemId, ...itemData }]);
      setCurrentItemCartId(cartItemId);
    }

    // Snapshot of the inputs so the generator stays correct even if the user
    // edits the customizer before the canvas finishes drawing.
    const productKey = selectedProduct;
    const designSnap = uploadedImage;
    const posSnap = { ...imagePos };
    const secondUrl = (secondFront.enabled && secondFront.image) ? secondFront.image : null;
    const secondPos = secondUrl ? { ...secondFront.pos } : null;
    // Compose the product + chosen colour + design overlay into a data URL,
    // then patch the cart line so the cart thumbnail matches the live preview.
    generateOrderMockup(productKey, colorHex, designSnap, posSnap, secondUrl, secondPos)
      .then(dataUrl => {
        setCart(c => c.map(it => it.id === cartItemId ? { ...it, mockupUrl: dataUrl } : it));
      })
      .catch(() => { /* fallback: cart UI uses uploadedImage / MOCKUP_URLS */ });

    return true;
  };

  const addToCart = () => commitCurrentItem();

  const resetForNewItem = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setSelectedColor(0);
    setUploadedImage(null);
    setImagePos({ x: 150, y: 130, size: 85 });
    setQty(1);
    setBackPrint(false);
    setBackDesign({ enabled: false, sameAsMain: true, image: null });
    setSecondFront({ enabled: false, image: null, pos: { x: 210, y: 120, size: 43 } });
    setSleeveLeft({ enabled: false, sameAsMain: true, image: null });
    setSleeveRight({ enabled: false, sameAsMain: true, image: null });
    setPositionLocked(false);
    setSecondPositionLocked(false);
    setActiveDesign('main');
    setCurrentItemCartId(null);
  };

  const removeFromCart = (id) => {
    setCart(c => c.filter(it => it.id !== id));
    if (id === currentItemCartId) setCurrentItemCartId(null);
  };

  // ── BLOOM direct order ──────────────────────────────────────────────
  // A character chosen from the BLOOM modal arrives as a ready-made item:
  // its design is already fixed (the character's design_url). We add it to
  // the cart and show the "added to cart" choice popup — no product picker,
  // no file upload. Runs once when the order page opens with a pending item.
  const bloomConsumedRef = useRef(false);
  useEffect(() => {
    if (bloomConsumedRef.current || !pendingBloomItem) return;
    bloomConsumedRef.current = true;
    const prod = products.find(p => p.id === pendingBloomItem.productId);
    if (!prod || !prod.variants.length) {
      // Bad data — close the popup so we never show an empty confirmation.
      setShowNextChoice(false);
      setNextChoiceIsBloom(false);
      clearPendingBloomItem();
      return;
    }
    const v = (pendingBloomItem.variantId && prod.variants.find(x => x.id === pendingBloomItem.variantId)) || prod.variants[0];
    const colorHex = pendingBloomItem.shirtColor ? pendingBloomItem.shirtColor.hex : prod.colors[0];
    const matchedIdx = prod.colors.indexOf(colorHex);
    const bloomCartItem = {
      id: Date.now() + Math.random(),
      productId: prod.id,
      productName: pendingBloomItem.characterName ? `${prod.name} · ${pendingBloomItem.characterName}` : prod.name,
      variantId: v.id,
      variantLabel: v.label,
      colorIdx: matchedIdx >= 0 ? matchedIdx : 0,
      color: colorHex,
      qty: 1,
      uploadedImage: pendingBloomItem.designUrl,
      mockupUrl: pendingBloomItem.mockupUrl || null,
      petName: pendingBloomItem.petName || null,
      petNameFont: pendingBloomItem.petNameFont || null,
      petNameColor: pendingBloomItem.petNameColor || null,
      imagePos: { x: 150, y: 130, size: 85 },
      backPrint: false,
      backDesign: { enabled: false, sameAsMain: true, image: null },
      secondFront: { enabled: false, image: null, sameAsMain: true, pos: { x: 210, y: 120, size: 43 } },
      sleeveLeft: { enabled: false, sameAsMain: true, image: null },
      sleeveRight: { enabled: false, sameAsMain: true, image: null },
      itemPrice: Number(pendingBloomItem.price) || 0,
    };
    setCart(c => [...c, bloomCartItem]);
    clearPendingBloomItem();
  }, []);

  // Checkout requested from the cart drawer — jump to the details step.
  useEffect(() => {
    if (pendingCheckout) { setStep(3); clearPendingCheckout(); }
  }, [pendingCheckout]);

  const safeGo = (action) => {
    if (step >= 2 && step < 4) { setLeaveWarning(true); setPendingNav(() => action); }
    else action();
  };

  // Warn user before leaving order page (mobile back button, tab close, refresh)
  useEffect(() => {
    const inProgress = (step >= 2 && step < 4) || (cart.length > 0 && step !== 4 && step !== 5);
    if (!inProgress) return;
    allowLeaveRef.current = false;
    // beforeunload — for tab close / refresh
    const beforeUnload = (e) => {
      if (allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    // popstate — for mobile/desktop browser back button within the SPA
    window.history.pushState({ orderInProgress: true }, "");
    const onPopState = () => {
      if (allowLeaveRef.current) return;
      // re-push state so we stay on this page; show modal
      window.history.pushState({ orderInProgress: true }, "");
      setLeaveWarning(true);
      setPendingNav(() => () => {
        allowLeaveRef.current = true;
        window.history.back();
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [step, cart.length]);

  const product = selectedProduct ? products.find(p => p.id === selectedProduct) : null;
  const variant = selectedVariant ? product?.variants.find(v => v.id === selectedVariant) : null;
  const cartItemsTotal = cart.reduce((sum, it) => sum + it.itemPrice, 0);
  const currentItemTotal = variant ? (variant.price * qty)
    + (backPrint ? BACK_PRINT_PRICE : 0)
    + (secondFront.enabled ? SECOND_FRONT_PRICE : 0)
    + (sleeveLeft.enabled ? SLEEVE_PRICE : 0)
    + (sleeveRight.enabled ? SLEEVE_PRICE : 0) : 0;
  const hasOrderInProgress = cart.length > 0 || (step === 2 && variant);
  const total = (cartItemsTotal + currentItemTotal) + (hasOrderInProgress ? shippingPrice : 0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError(uiFileTooLarge(lang)); e.target.value = ``; return; }
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target.result);
      setSelectedPlacement(null); setSelectedSize(null);
      const pa = product.printArea;
      setImagePos({ x: pa.x + pa.w / 2 - 42, y: pa.y + pa.h / 2 - 42, size: 85 });
    };
    reader.readAsDataURL(file);
  };

  const handleExtraUpload = (e, setter, isSecondFront = false) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError(uiFileTooLarge(lang)); e.target.value = ``; return; }
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setter(prev => ({ ...prev, image: ev.target.result, sameAsMain: false }));
      if (isSecondFront) {
        // Start second design at same size as main, switch drag to second
        setSecondFront(prev => ({ ...prev, image: ev.target.result, sameAsMain: false, pos: { ...prev.pos, size: imagePos.size } }));
        setActiveDesign('second');
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadDesignImage = async (dataUrl) => {
    if (!dataUrl) return null;
    // BLOOM designs are already hosted on Supabase — reuse the URL, don't re-upload.
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const fileName = `design-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('designs').upload(fileName, blob, { contentType: blob.type, upsert: false });
      if (data && !error) {
        const { data: urlData } = supabase.storage.from('designs').getPublicUrl(fileName);
        return urlData.publicUrl;
      }
    } catch (e) { console.log('Upload error:', e); }
    return null;
  };

  const applyPlacementAndSize = (placementId, sizeId) => {
    const placements = PLACEMENTS[product.id] || PLACEMENTS.tshirt;
    const sizes = SIZE_OPTIONS[product.id] || SIZE_OPTIONS.tshirt;
    const pl = placements.find(p => p.id === placementId);
    const sz = sizes.find(s => s.id === sizeId);
    if (pl && sz) {
      setImagePos({ x: pl.cx - sz.px / 2, y: pl.cy - sz.px / 2, size: sz.px });
    }
  };

  const handleSelectPlacement = (placementId) => {
    const placements = PLACEMENTS[product.id] || PLACEMENTS.tshirt;
    const pl = placements.find(p => p.id === placementId);
    setSelectedPlacement(placementId);
    // Left chest is small only — auto-select small
    if (pl?.smallOnly) {
      setSelectedSize("small");
      applyPlacementAndSize(placementId, "small");
    } else if (selectedSize) {
      applyPlacementAndSize(placementId, selectedSize);
    }
  };

  const nudge = (dx, dy) => {
    if (!product) return;
    const pa = product.printArea;
    if (activeDesign === 'second') {
      setSecondFront(p => ({
        ...p, pos: {
          ...p.pos,
          x: Math.max(pa.x, Math.min(pa.x + pa.w - p.pos.size, p.pos.x + dx)),
          y: Math.max(pa.y, Math.min(pa.y + pa.h - p.pos.size, p.pos.y + dy)),
        }
      }));
    } else {
      setImagePos(p => ({
        ...p,
        x: Math.max(pa.x, Math.min(pa.x + pa.w - p.size, p.x + dx)),
        y: Math.max(pa.y, Math.min(pa.y + pa.h - p.size, p.y + dy)),
      }));
    }
  };

  const handleSelectSize = (sizeId) => {
    setSelectedSize(sizeId);
    if (!product) return;
    const sizes = SIZE_OPTIONS[product.id] || SIZE_OPTIONS.tshirt;
    const sz = sizes.find(s => s.id === sizeId);
    if (!sz) return;
    const pa = product.printArea;
    const newSize = Math.min(160, sz.px);
    if (activeDesign === 'second') {
      setSecondFront(p => ({ ...p, pos: { ...p.pos, size: newSize, x: Math.max(pa.x, Math.min(pa.x + pa.w - newSize, p.pos.x)), y: Math.max(pa.y, Math.min(pa.y + pa.h - newSize, p.pos.y)) } }));
    } else {
      setImagePos(p => ({ ...p, size: newSize, x: Math.max(pa.x, Math.min(pa.x + pa.w - newSize, p.x)), y: Math.max(pa.y, Math.min(pa.y + pa.h - newSize, p.y)) }));
    }
  };

  const clampToArea = (x, y, size, pa) => ({
    x: Math.max(pa.x, Math.min(pa.x + pa.w - size, x)),
    y: Math.max(pa.y, Math.min(pa.y + pa.h - size, y)),
  });

  const handleMouseDown = (e) => {
    const lockForActive = activeDesign === 'second' ? secondPositionLocked : positionLocked;
    if (lockForActive) return;
    e.preventDefault();
    setDragging(true);
    const rect = mockupImageRef.current.getBoundingClientRect();
    const pos = getActivePos();
    setDragStart({ mx: e.clientX, my: e.clientY, ix: pos.x, iy: pos.y, size: pos.size, scaleX: 400 / rect.width, scaleY: 400 / rect.height, isSecond: activeDesign === 'second' });
  };

  const getActivePos = () => activeDesign === 'second' ? secondFront.pos : imagePos;
  const getActiveSize = () => activeDesign === 'second' ? secondFront.pos.size : imagePos.size;

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !dragStart || !product) return;
    const rawX = dragStart.ix + (e.clientX - dragStart.mx) * dragStart.scaleX;
    const rawY = dragStart.iy + (e.clientY - dragStart.my) * dragStart.scaleY;
    const { x, y } = clampToArea(rawX, rawY, dragStart.size, product.printArea);
    if (dragStart.isSecond) setSecondFront(p => ({ ...p, pos: { ...p.pos, x, y } }));
    else setImagePos(p => ({ ...p, x, y }));
  }, [dragging, dragStart, product]);

  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e) => {
    const lockForActive = activeDesign === 'second' ? secondPositionLocked : positionLocked;
    if (!uploadedImage || lockForActive) return;
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const currentSize = activeDesign === 'second' ? secondFront.pos.size : imagePos.size;
      pinchRef.current = { dist, size: currentSize, isSecond: activeDesign === 'second' };
      return;
    }
    const touch = e.touches[0];
    setDragging(true);
    const rect = mockupImageRef.current.getBoundingClientRect();
    const pos = getActivePos();
    setDragStart({ mx: touch.clientX, my: touch.clientY, ix: pos.x, iy: pos.y, size: pos.size, scaleX: 400 / rect.width, scaleY: 400 / rect.height, isSecond: activeDesign === 'second' });
  };

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchRef.current.dist;
      const newSize = Math.min(160, Math.max(43, Math.round(pinchRef.current.size * ratio)));
      if (pinchRef.current.isSecond) {
        setSecondFront(p => ({ ...p, pos: { ...p.pos, size: newSize } }));
      } else {
        setImagePos(p => ({ ...p, size: newSize }));
      }
      return;
    }
    pinchRef.current = null;
    if (!dragging || !dragStart || !product) return;
    const touch = e.touches[0];
    const rawX = dragStart.ix + (touch.clientX - dragStart.mx) * dragStart.scaleX;
    const rawY = dragStart.iy + (touch.clientY - dragStart.my) * dragStart.scaleY;
    const { x, y } = clampToArea(rawX, rawY, dragStart.size, product.printArea);
    if (dragStart.isSecond) setSecondFront(p => ({ ...p, pos: { ...p.pos, x, y } }));
    else setImagePos(p => ({ ...p, x, y }));
  }, [dragging, dragStart, product]);

  // Keep ref updated so native listeners always call latest version
  touchHandlersRef.current = { start: handleTouchStart, move: handleTouchMove };

  const fetchAddrSuggestions = (query) => {
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    if (!query || query.trim().length < 3) {
      setAddrSuggestions([]);
      setShowAddrSugg(false);
      return;
    }
    addrTimerRef.current = setTimeout(async () => {
      try {
        setAddrLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=il&limit=6&addressdetails=1&accept-language=${lang === "he" ? "he" : lang === "ru" ? "ru" : "en"}`;
        const res = await fetch(url);
        const data = await res.json();
        setAddrSuggestions(Array.isArray(data) ? data : []);
        setShowAddrSugg(true);
      } catch (e) {
        console.error("Nominatim error:", e);
      }
      setAddrLoading(false);
    }, 400);
  };

  const selectAddress = (item) => {
    const a = item.address || {};
    const houseNumber = a.house_number ? `${a.house_number} ` : "";
    const street = a.road || a.pedestrian || a.suburb || "";
    const fullStreet = (street ? `${street} ${houseNumber}`.trim() : item.display_name.split(",")[0]).trim();
    const city = a.city || a.town || a.village || a.municipality || "";
    const postalCode = a.postcode || "";
    setForm(p => ({ ...p, street: fullStreet, city, postalCode }));
    setShowAddrSugg(false);
    setAddrSuggestions([]);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    // Inline validation — show field-level trilingual errors instead of silently
    // doing nothing; values stay in `form`.
    const errs = validateCheckout();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); setSubmitError(lang === "he" ? "יש לתקן את השדות המסומנים." : lang === "ru" ? "Исправьте отмеченные поля." : "Please fix the highlighted fields."); return; }
    setFieldErrors({}); setSubmitError("");
    setSubmitting(true);
    const phone = form.phoneNumber ? `${form.phonePrefix}-${form.phoneNumber}` : "";
    const orderGroupId = `grp-${Date.now()}`;

    try {
      const createdOrderIds = [];
      // Does this checkout contain a customer-uploaded custom design? If so the
      // whole group waits for design approval before payment (you can't pay for
      // half a cart). BLOOM / pet-name items carry an https design URL; only a
      // user file upload arrives as a data: URL — that's the discriminator.
      let groupNeedsApproval = false;
      for (let i = 0; i < cart.length; i++) {
        const it = cart[i];

        // BLOOM sticker packs are a flat product — no design upload, no
        // customizer, no per-side prints. Build a minimal row and skip the
        // shirt-style image pipeline below.
        if (it.productId === `sticker_pack`) {
          const packImage = it.stickerPack?.imageUrl || it.mockupUrl || null;
          const packItemTotal = it.itemPrice + (i === 0 ? shippingPrice : 0);
          const packRow = {
            customer_name: form.name, customer_email: form.email, customer_phone: phone,
            customer_street: form.street, customer_city: form.city, customer_postal_code: form.postalCode,
            product: it.productName,
            variant: it.variantLabel || it.variantId || `pack`,
            color: null,
            quantity: it.qty,
            total: packItemTotal,
            notes: form.notes,
            status: `pending_payment`,
            payment_status: `idle`,
            currency: `ILS`,
            user_id: user?.id || null,
            design_url: packImage,
            mockup_url: packImage,
            product_color: null,
            language: lang,
            back_print: false,
            extra_prints: { kind: `sticker_pack`, pack: it.stickerPack || null, shipping_method: shippingMethod },
            order_group: orderGroupId,
          };
          if (user) {
            const { data: orderData, error } = await supabase.from(`orders`).insert(packRow).select().single();
            if (error) throw error;
            if (orderData?.id) createdOrderIds.push(orderData.id);
          } else {
            const { error } = await supabase.from(`orders`).insert(packRow);
            if (error) throw error;
          }
          continue;
        }

        const itProduct = products.find(p => p.id === it.productId);
        const itVariant = itProduct?.variants.find(v => v.id === it.variantId);
        if (!itProduct || !itVariant) continue;

        const [design_url, second_front_url, back_design_url, sleeve_left_url, sleeve_right_url] = await Promise.all([
          uploadDesignImage(it.uploadedImage),
          it.secondFront.enabled && !it.secondFront.sameAsMain ? uploadDesignImage(it.secondFront.image) : Promise.resolve(null),
          it.backPrint && it.backDesign.image && !it.backDesign.sameAsMain ? uploadDesignImage(it.backDesign.image) : Promise.resolve(null),
          it.sleeveLeft.enabled && it.sleeveLeft.image && !it.sleeveLeft.sameAsMain ? uploadDesignImage(it.sleeveLeft.image) : Promise.resolve(null),
          it.sleeveRight.enabled && it.sleeveRight.image && !it.sleeveRight.sameAsMain ? uploadDesignImage(it.sleeveRight.image) : Promise.resolve(null),
        ]);

        const itemTotal = it.itemPrice + (i === 0 ? shippingPrice : 0);

        // Custom upload = the customer's own image (a data: URL pre-upload).
        // BLOOM items carry an https:// design URL and skip approval.
        const isCustomUpload = !!(it.uploadedImage && !/^https?:\/\//i.test(it.uploadedImage));
        if (isCustomUpload) groupNeedsApproval = true;

        // Snapshot what the customer saw into one flattened mockup image.
        // BLOOM items already carry a public mockup URL (uploadDesignImage
        // returns http(s) URLs as-is). Mug Studio items carry a data URL —
        // uploadDesignImage uploads it to the designs bucket and returns the
        // public URL. Shirt items have mockupUrl=null and fall through to
        // the regen block below.
        let mockup_url = it.mockupUrl ? await uploadDesignImage(it.mockupUrl) : null;
        if (!mockup_url) {
          try {
            const mockupPng = await generateOrderMockup(
              it.productId,
              it.color,
              it.uploadedImage,
              it.imagePos,
              it.secondFront.enabled ? (it.secondFront.sameAsMain ? it.uploadedImage : it.secondFront.image) : null,
              it.secondFront.enabled ? it.secondFront.pos : null,
            );
            mockup_url = await uploadDesignImage(mockupPng);
          } catch (mockErr) {
            console.error("Order mockup generation failed:", mockErr);
          }
        }

        const orderRow = {
          customer_name: form.name, customer_email: form.email, customer_phone: phone,
          customer_street: form.street, customer_city: form.city, customer_postal_code: form.postalCode,
          product: itProduct.name, variant: itVariant.label, color: it.color,
          quantity: it.qty, total: itemTotal, notes: form.notes,
          pet_name: it.petName || null,
          pet_name_font: it.petNameFont || null,
          pet_name_color: it.petNameColor || null,
          // Custom uploads must be approved before payment. We set the status
          // explicitly (the DB default is 'not_required' and there is no
          // auto-set trigger, so relying on a default would never queue it).
          requires_design_approval: isCustomUpload,
          design_approval_status: isCustomUpload ? "pending" : "not_required",
          status: "pending_payment",
          payment_status: "idle",
          currency: "ILS",
          user_id: user?.id || null, design_url,
          mockup_url,
          design_x: it.imagePos.x, design_y: it.imagePos.y, design_size: it.imagePos.size,
          product_color: it.color, language: lang,
          back_print: it.backPrint,
          second_front_url: it.secondFront.enabled ? (it.secondFront.sameAsMain ? design_url : second_front_url) : null,
          second_front_x: it.secondFront.enabled ? it.secondFront.pos.x : null,
          second_front_y: it.secondFront.enabled ? it.secondFront.pos.y : null,
          second_front_size: it.secondFront.enabled ? it.secondFront.pos.size : null,
          back_design_url: it.backPrint ? (it.backDesign.sameAsMain ? design_url : back_design_url) : null,
          sleeve_left_url: it.sleeveLeft.enabled ? (it.sleeveLeft.sameAsMain ? design_url : sleeve_left_url) : null,
          sleeve_right_url: it.sleeveRight.enabled ? (it.sleeveRight.sameAsMain ? design_url : sleeve_right_url) : null,
          order_group: orderGroupId,
          // Shipping method on every row so the admin can route the package
          // correctly (locker drop-off vs courier door-to-door). The total
          // already reflects the chosen rate; this just records the customer
          // choice. Stored on extra_prints (jsonb) to avoid a schema change.
          extra_prints: { shipping_method: shippingMethod },
        };

        if (user) {
          // Logged-in customers can read their own rows back under RLS — keep .select().
          const { data: orderData, error } = await supabase.from("orders").insert(orderRow).select().single();
          if (error) throw error;
          if (orderData?.id) createdOrderIds.push(orderData.id);
        } else {
          // Guests can't read rows back once anon SELECT is restricted — insert only.
          const { error } = await supabase.from("orders").insert(orderRow);
          if (error) throw error;
        }
      }

      // NO email is sent here. Order emails (customer confirmation + business
      // alert) are sent SERVER-SIDE by the Tranzila webhook only AFTER a payment
      // is confirmed succeeded — so nothing goes out before payment. The previous
      // pre-payment send-order-confirmation + send-admin-order-alert calls were
      // removed; do not re-add them.
      const confirmedTotal = cartItemsTotal + shippingPrice;

      // Save context for the payment step.
      setPendingOrderGroupId(orderGroupId);
      setPendingOrderIds(createdOrderIds);
      setPendingTotal(confirmedTotal);

      allowLeaveRef.current = true;
      if (groupNeedsApproval) {
        // Custom design(s) submitted — skip payment. The customer pays later
        // from /track once we approve. Go straight to the confirmation screen
        // (it shows the "submitted for approval" message instead of payment).
        //
        // Notify the business that a custom design is waiting for review. This is
        // the ONLY pre-payment notification (the normal purchase path stays
        // email-free until the webhook confirms payment). Fire-and-forget: a
        // failed invoke must never block or break the customer's submission.
        supabase.functions
          .invoke(`notify-design-submission`, { body: { orderGroup: orderGroupId } })
          .catch(() => {});
        setSubmittedForApproval(true);
        setCart([]);
        setStep(5);
      } else {
        setSubmittedForApproval(false);
        setStep(4);
      }
    } catch (e) {
      console.error(`[checkout] order submit failed:`, e);
      setSubmitError(uiGenericError(lang));
    }
    setSubmitting(false);
  };

  // Optional account creation offered on the confirmation screen. After sign-in,
  // App routes the customer to their order tracking page (orders match by email).
  const handleGoogleSignup = async () => {
    setAccountError(""); setAccountBusy(true);
    try {
      localStorage.setItem("sxp_track_after_login", "1");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      localStorage.removeItem("sxp_track_after_login");
      setAccountError(err.message);
      setAccountBusy(false);
    }
  };

  const handleAccountMagicLink = async () => {
    if (!form.email) return;
    setAccountError(""); setAccountBusy(true);
    try {
      localStorage.setItem("sxp_track_after_login", "1");
      const { error } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setAccountSent(true);
    } catch (err) {
      localStorage.removeItem("sxp_track_after_login");
      setAccountError(err.message);
    }
    setAccountBusy(false);
  };

  const inputStyle = { width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none" };
  const labelStyle = { color: COLORS.gray, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      {/* Payment-failure return (#order?paid=0) — full-screen retry state. */}
      {payFailed && (
        <div role="dialog" aria-modal="true" aria-label={lang === "he" ? "התשלום לא הושלם" : lang === "ru" ? "Оплата не завершена" : "Payment didn't go through"}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir }}>
          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.accent}`, borderRadius: 16, padding: "40px 32px", maxWidth: 440, width: "100%", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: "50%", background: "rgba(248,113,113,0.12)", border: "2px solid #f87171", marginBottom: 20, fontSize: 38, color: "#f87171", fontWeight: 700 }}>✕</div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 26, margin: "0 0 10px" }}>{lang === "he" ? "התשלום לא הושלם" : lang === "ru" ? "Оплата не завершена" : "Payment didn't go through"}</h2>
            <p style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{lang === "he" ? "לא חויבת. אפשר לנסות שוב — ההזמנה שלך נשמרה." : lang === "ru" ? "С вас не списали. Можно попробовать снова — ваш заказ сохранён." : "You weren't charged. You can try again — your order is saved."}</p>
            <button onClick={() => { try { window.history.replaceState({}, ``, `${window.location.pathname}#order`); } catch (_) {} setPayFailed(false); setStep(1); }}
              style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", marginBottom: 10 }}>
              {lang === "he" ? "לנסות שוב" : lang === "ru" ? "Попробовать снова" : "Try again"}
            </button>
            <button onClick={() => { try { window.history.replaceState({}, ``, `${window.location.pathname}#order`); } catch (_) {} setPayFailed(false); setPage("track"); }}
              style={{ width: "100%", background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
              {lang === "he" ? "מעקב ההזמנות שלי" : lang === "ru" ? "К моим заказам" : "Track my orders"}
            </button>
          </div>
        </div>
      )}
      <div style={{ maxWidth: step === 3 ? 1100 : 700, margin: "0 auto", padding: "24px 24px 60px", transition: "max-width 0.25s ease" }}>
        <div style={{ display: "flex", marginBottom: 40 }}>
          {t.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step >= i + 1 ? COLORS.accent : COLORS.bgCard, border: `2px solid ${step >= i + 1 ? COLORS.accent : COLORS.border}`, color: step >= i + 1 ? "#fff" : COLORS.gray, fontSize: 13, fontWeight: 600 }}>{step > i + 1 ? "✓" : i + 1}</div>
              {!isVeryNarrow && <div style={{ fontSize: isMobile ? 10 : 11, color: step === i + 1 ? COLORS.accent : COLORS.gray, marginTop: 6, textAlign: "center", lineHeight: 1.25 }}>{s}</div>}
            </div>
          ))}
        </div>

        {/* Leave warning modal */}
        {leaveWarning && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 32, maxWidth: 360, width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <div style={{ color: COLORS.white, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {lang === "he" ? "לעזוב את ההזמנה?" : lang === "ru" ? "Покинуть заказ?" : "Leave order?"}
              </div>
              <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
                {lang === "he" ? "הפרטים שהזנת יאבדו" : lang === "ru" ? "Введённые данные будут потеряны" : "Your progress will be lost"}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setLeaveWarning(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, borderRadius: 8, padding: "12px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {lang === "he" ? "המשך הזמנה" : lang === "ru" ? "Продолжить" : "Keep ordering"}
                </button>
                <button onClick={() => { setLeaveWarning(false); pendingNav && pendingNav(); }} style={{ flex: 1, background: "#ef4444", border: "none", color: "#fff", borderRadius: 8, padding: "12px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {lang === "he" ? "עזוב" : lang === "ru" ? "Уйти" : "Leave"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showNextChoice && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "rgba(40,200,120,0.12)", border: "2px solid #28C878", marginBottom: 16, color: "#28C878", fontSize: 26, fontWeight: 700 }}>✓</div>
              <div style={{ color: COLORS.white, fontSize: 20, fontWeight: 700, marginBottom: 8, fontFamily: "'Playfair Display',serif" }}>
                {lang === "he" ? "הפריט נוסף לסל!" : lang === "ru" ? "Товар добавлен в корзину!" : "Item added to cart!"}
              </div>
              <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
                {lang === "he" ? "מה ברצונך לעשות?" : lang === "ru" ? "Что бы вы хотели сделать?" : "What would you like to do?"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => {
                  if (nextChoiceIsBloom) { setShowNextChoice(false); setNextChoiceIsBloom(false); setPage("pets"); }
                  else if (addToCart()) { resetForNewItem(); setShowNextChoice(false); setStep(1); }
                }} style={{ background: COLORS.bgCard, border: `2px solid ${COLORS.accent}`, color: COLORS.accent, borderRadius: 10, padding: "14px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 15 }}>
                  {lang === "he" ? "הוסף עוד פריט" : lang === "ru" ? "Добавить ещё товар" : "Add another item"}
                </button>
                <button onClick={() => {
                  if (nextChoiceIsBloom) { setShowNextChoice(false); setNextChoiceIsBloom(false); setStep(3); }
                  else if (addToCart()) { setShowNextChoice(false); setStep(3); }
                }} style={{ background: COLORS.accentBtn, border: "none", color: "#fff", borderRadius: 10, padding: "14px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 16px rgba(255,107,53,0.3)" }}>
                  {lang === "he" ? "לתשלום ולסיום" : lang === "ru" ? "К оплате" : "Proceed to checkout"}
                </button>
                <button onClick={() => { setShowNextChoice(false); setNextChoiceIsBloom(false); }} style={{ background: "transparent", border: "none", color: COLORS.gray, padding: "10px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13 }}>
                  {lang === "he" ? "ביטול" : lang === "ru" ? "Отмена" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            {cart.length > 0 && (
              <div style={{ background: "rgba(255,107,53,0.1)", border: `2px solid ${COLORS.accent}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ color: COLORS.accent, fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>
                    {lang === "he" ? `${cart.length} פריטים בסל` : lang === "ru" ? `${cart.length} товаров в корзине` : `${cart.length} items in cart`}
                  </div>
                  <div style={{ color: COLORS.white, fontSize: 13, marginTop: 2 }}>
                    {lang === "he" ? "סה״כ:" : lang === "ru" ? "Итого:" : "Total:"} ₪{cartItemsTotal + shippingPrice}
                  </div>
                </div>
                <button onClick={() => setStep(3)} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontFamily: "'Varela Round',sans-serif", fontSize: 13 }}>
                  {lang === "he" ? "לתשלום" : lang === "ru" ? "К оплате" : "Checkout"} →
                </button>
              </div>
            )}
            <h1 className="reveal" style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.product.title}</h1>
            <p className="reveal" data-delay="1" style={{ color: COLORS.gray, marginBottom: 20 }}>{t.product.sub}</p>
            <div className="reveal" data-delay="2" style={{ marginBottom: 24 }}>
              <TrustRow lang={lang} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {products.map((p, idx) => (
                <div key={p.id} role="button" tabIndex={0} aria-pressed={selectedProduct === p.id} aria-label={p.name} className="reveal" data-delay={String(Math.min(idx + 1, 6))}
                  onClick={() => { setSelectedProduct(p.id); setSelectedVariant(p.variants[0].id); setSelectedColor(0); setUploadedImage(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedProduct(p.id); setSelectedVariant(p.variants[0].id); setSelectedColor(0); setUploadedImage(null); } }}
                  style={{ background: selectedProduct === p.id ? "rgba(255,107,53,0.1)" : COLORS.bgCard, border: `2px solid ${selectedProduct === p.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: isMobile ? "16px 16px" : "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 18, flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 18 : 22, fontStyle: "italic", color: selectedProduct === p.id ? COLORS.accent : "#555", minWidth: isMobile ? 22 : 32, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                    <div style={{ width: isMobile ? 44 : 54, height: isMobile ? 44 : 54, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SmartImage src={transformImage(MOCKUP_URLS[p.id], { width: 120 })} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ color: COLORS.white, fontWeight: 600, fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 16 : 18 }}>{p.name}</span>
                        {p.is_bestseller && <span style={{ background: COLORS.accentBtn, color: "#fff", fontFamily: "'Varela Round',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4 }}>{LANGS[lang].badges.bestseller}</span>}
                        {p.is_new && <span style={{ background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, fontFamily: "'Varela Round',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 4 }}>{LANGS[lang].badges.new}</span>}
                      </div>
                      <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{p.desc?.[lang] || p.desc?.en || ""}</div>
                      <div style={{ color: COLORS.accent, fontSize: 13, marginTop: 6, fontWeight: 700 }}>{formatPriceRange(p.variants)} <span style={{ color: COLORS.gray, fontWeight: 400 }}>· {p.variants.length} {t.product.options}</span></div>
                    </div>
                  </div>
                  {selectedProduct === p.id && <span style={{ color: COLORS.accent, flexShrink: 0 }}>✓</span>}
                </div>
              ))}
            </div>
            <button onClick={() => selectedProduct && setStep(2)} disabled={!selectedProduct} style={{ marginTop: 24, width: "100%", background: selectedProduct ? COLORS.accent : COLORS.bgCard, color: selectedProduct ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: selectedProduct ? "pointer" : "not-allowed", fontFamily: "'Varela Round',sans-serif" }}>{t.product.continue}</button>
          </div>
        )}

        {step === 2 && product && (
          <div>
            <h1 className="reveal" style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.customize.title(product.name)}</h1>
            <p className="reveal" data-delay="1" style={{ color: COLORS.gray, marginBottom: 24 }}>{t.customize.sub}</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <div ref={mockupRef}
                    onClick={() => !uploadedImage && fileRef.current.click()}
                    style={{ background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 0, position: "relative", userSelect: "none", cursor: uploadedImage ? "grab" : "pointer", maxWidth: 280, margin: "0 auto" }}
                    onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onTouchEnd={handleMouseUp}>
                    <div ref={mockupImageRef} style={{ position: "relative" }}>
                    {product.id === "tshirt"    && <TShirtMockup    color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} secondImageUrl={secondFront.enabled ? secondFront.image : null} secondImagePos={secondFront.pos} />}
                    {product.id === "oversized" && <OversizedMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} secondImageUrl={secondFront.enabled ? secondFront.image : null} secondImagePos={secondFront.pos} />}
                    {product.id === "stonewash" && <OversizedMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} secondImageUrl={secondFront.enabled ? secondFront.image : null} secondImagePos={secondFront.pos} />}
                    {product.id === "dryfit"    && <DryfitMockup    color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} secondImageUrl={secondFront.enabled ? secondFront.image : null} secondImagePos={secondFront.pos} />}
                    {product.id === "mug"       && <MugMockup       color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                    {product.id === "sticker"    && <StickerMockup   color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                    {product.id === "sticker_sq" && <StickerSqMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                    {/* Drag overlay — inside shirt-only ref */}
                    {uploadedImage && (
                      <div onMouseDown={handleMouseDown}
                        style={{ position: "absolute",
                          left: `${(getActivePos().x / 400) * 100}%`,
                          top: `${(getActivePos().y / 400) * 100}%`,
                          width: `${(getActivePos().size / 400) * 100}%`,
                          height: `${(getActivePos().size / 400) * 100}%`,
                          cursor: dragging ? "grabbing" : "grab", zIndex: 10,
                          touchAction: "none",
                          borderRadius: 4,
                        }} />
                    )}
                    </div>
                    <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", padding: "6px 0 4px" }}>
                      {uploadedImage
                        ? isMobile
                          ? (lang === "he" ? "✋ גרור להזזה · 🤏 צבוט לשינוי גודל" : "✋ Drag to move · 🤏 Pinch to resize")
                          : (lang === "he" ? "✋ גרור לכוונון מיקום" : "✋ Drag to position")
                        : (lang === "he" ? "👆 לחץ להעלאת עיצוב" : "👆 Tap to upload design")}
                    </p>
                    {/* Design selector — shown when two designs exist */}
                    {uploadedImage && secondFront.enabled && secondFront.image && (
                      <div style={{ display: "flex", gap: 6, padding: "0 12px 8px" }}>
                        <button onClick={() => setActiveDesign('main')} style={{ flex: 1, background: activeDesign === 'main' ? COLORS.accent : COLORS.bgCard, border: `1px solid ${activeDesign === 'main' ? COLORS.accent : COLORS.border}`, color: activeDesign === 'main' ? "#fff" : COLORS.gray, borderRadius: 6, padding: "6px", fontSize: 11, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                          {lang === "he" ? "עיצוב ראשי" : "Main Design"}
                        </button>
                        <button onClick={() => setActiveDesign('second')} style={{ flex: 1, background: activeDesign === 'second' ? COLORS.accent : COLORS.bgCard, border: `1px solid ${activeDesign === 'second' ? COLORS.accent : COLORS.border}`, color: activeDesign === 'second' ? "#fff" : COLORS.gray, borderRadius: 6, padding: "6px", fontSize: 11, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                          {lang === "he" ? "עיצוב שני" : "2nd Design"}
                        </button>
                      </div>
                    )}
                    {/* Mobile-only: collapsible manual fine-tune + size */}
                    {isMobile && uploadedImage && !["mug"].includes(product.id) && (
                      <div style={{ padding: "8px 12px 12px" }}>
                        {/* Collapsible manual fine-tune */}
                        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                          <div onClick={() => setShowNudge(s => !s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", cursor: "pointer", background: showNudge ? "rgba(255,107,53,0.08)" : "transparent" }}>
                            <span style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {lang === "he" ? "🎛️ כיוונון ידני" : lang === "ru" ? "🎛️ Ручная настройка" : "🎛️ Manual fine-tune"}
                            </span>
                            <span style={{ color: COLORS.gray, fontSize: 12 }}>{showNudge ? "▲" : "▼"}</span>
                          </div>
                          {showNudge && (
                            <div style={{ padding: "10px", borderTop: `1px solid ${COLORS.border}` }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, width: 120, margin: "0 auto" }}>
                                <div />
                                <button onClick={() => nudge(0, -5)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>↑</button>
                                <div />
                                <button onClick={() => nudge(isRTL ? 5 : -5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>{isRTL ? "→" : "←"}</button>
                                <div style={{ background: COLORS.bg, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: COLORS.gray }}>✛</span></div>
                                <button onClick={() => nudge(isRTL ? -5 : 5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>{isRTL ? "←" : "→"}</button>
                                <div />
                                <button onClick={() => nudge(0, 5)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>↓</button>
                                <div />
                              </div>
                            </div>
                          )}
                        </div>
                        <label style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{lang === "he" ? "גודל" : "Size"}</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(SIZE_OPTIONS[product.id] || SIZE_OPTIONS.tshirt).map(sz => (
                            <button key={sz.id} onClick={() => handleSelectSize(sz.id)}
                              style={{ flex: 1, background: selectedSize === sz.id ? COLORS.accent : COLORS.bgCard, border: `1px solid ${selectedSize === sz.id ? COLORS.accent : COLORS.border}`, color: selectedSize === sz.id ? "#fff" : COLORS.white, borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", textAlign: "center" }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>{sz.label[lang] || sz.label.en}</div>
                              <div style={{ fontSize: 10, opacity: 0.8 }}>{sz.cm}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Drag overlay moved to inside mockupImageRef above */}
                  </div>
                  {/* Lock position buttons — main + second design */}
                  {uploadedImage && (
                    <button onClick={() => { setActiveDesign('main'); setPositionLocked(p => !p); }} style={{ width: "100%", marginTop: 8, background: positionLocked ? COLORS.bgCard : COLORS.accent, color: positionLocked ? COLORS.accent : "#fff", border: `2px solid ${COLORS.accent}`, borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", boxShadow: positionLocked ? "none" : "0 4px 12px rgba(255,107,53,0.3)" }}>
                      {positionLocked
                        ? (lang === "he" ? "✏️ ערוך מיקום עיצוב ראשי" : lang === "ru" ? "✏️ Редактировать основной" : "✏️ Edit main position")
                        : (lang === "he" ? "✓ אישור מיקום עיצוב ראשי" : lang === "ru" ? "✓ Сохранить основной" : "✓ Lock main position")}
                    </button>
                  )}
                  {uploadedImage && secondFront.enabled && secondFront.image && (
                    <button onClick={() => { setActiveDesign('second'); setSecondPositionLocked(p => !p); }} style={{ width: "100%", marginTop: 8, background: secondPositionLocked ? COLORS.bgCard : "#a78bfa", color: secondPositionLocked ? "#a78bfa" : "#fff", border: `2px solid #a78bfa`, borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", boxShadow: secondPositionLocked ? "none" : "0 4px 12px rgba(167,139,250,0.3)" }}>
                      {secondPositionLocked
                        ? (lang === "he" ? "✏️ ערוך מיקום עיצוב שני" : lang === "ru" ? "✏️ Редактировать второй" : "✏️ Edit 2nd position")
                        : (lang === "he" ? "אישור מיקום עיצוב שני" : lang === "ru" ? "Сохранить второй" : "Lock 2nd position")}
                    </button>
                  )}
                  {/* Mobile size slider — below mockup */}
                  {isMobile && uploadedImage && (
                    <div style={{ padding: "10px 4px 4px" }}>
                      <label style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span>{lang === "he" ? "גודל עיצוב" : lang === "ru" ? "Размер дизайна" : "Design Size"}</span>
                        <span style={{ color: COLORS.accent, fontWeight: 700 }}>{Math.round((imagePos.size / 160) * 30)} cm</span>
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setImagePos(p => ({ ...p, size: Math.max(43, p.size - 7) }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>−</button>
                        <input type="range" min={43} max={160} value={Math.min(160, Math.max(43, imagePos.size))} onChange={e => setImagePos(p => ({ ...p, size: Number(e.target.value) }))} style={{ flex: 1, accentColor: COLORS.accent }} />
                        <button onClick={() => setImagePos(p => ({ ...p, size: Math.min(160, p.size + 7) }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={labelStyle}>{["tshirt","oversized","stonewash","dryfit"].includes(product.id) ? t.customize.size : t.customize.option}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.variants.map(v => <button key={v.id} type="button" aria-pressed={selectedVariant === v.id} onClick={() => setSelectedVariant(v.id)} style={{ background: selectedVariant === v.id ? COLORS.accentBtn : COLORS.bgCard, border: `1px solid ${selectedVariant === v.id ? COLORS.accent : COLORS.border}`, color: selectedVariant === v.id ? "#fff" : COLORS.white, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 500, transition: "all 0.15s" }}>{v.label}</button>)}
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>{t.customize.color}</span>
                    {product.colors[selectedColor] && (
                      <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                        {colorName(product.colors[selectedColor], lang)}
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {product.colors.map((c, i) => (
                      <button key={i} type="button" onClick={() => setSelectedColor(i)}
                        title={colorName(c, lang)}
                        aria-label={colorName(c, lang)}
                        aria-pressed={selectedColor === i}
                        style={{ width: 32, height: 32, borderRadius: "50%", background: c, cursor: "pointer", padding: 0, border: `3px solid ${selectedColor === i ? COLORS.accent : "transparent"}`, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", transition: "transform 0.15s", transform: selectedColor === i ? "scale(1.2)" : "scale(1)" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t.customize.design}</label>
                  <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${uploadedImage ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer" }} onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent} onMouseOut={e => e.currentTarget.style.borderColor = uploadedImage ? COLORS.accent : COLORS.border}>
                    {uploadedImage ? <><img src={uploadedImage} alt={lang === "he" ? "תצוגה מקדימה של העיצוב שהועלה" : lang === "ru" ? "Предпросмотр загруженного дизайна" : "Uploaded design preview"} style={{ width: 50, height: 50, objectFit: "contain", borderRadius: 6, marginBottom: 6 }} /><div style={{ color: COLORS.accent, fontSize: 12 }}>{t.customize.uploaded}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.changeFile}</div></> : <><div style={{ fontSize: 24, marginBottom: 6 }}>📁</div><div style={{ color: COLORS.white, fontSize: 13 }}>{t.customize.uploadTitle}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.uploadSub}</div></>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
                  {uploadError && <div role="alert" style={{ color: "#f87171", fontSize: 12, marginTop: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", padding: "8px 12px", borderRadius: 8 }}>{uploadError}</div>}
                </div>
                {/* Free size control — desktop only (mobile has it below mockup) */}
                {!isMobile && uploadedImage && (
                  <div>
                    <label style={labelStyle}>
                      {lang === "he" ? "גודל עיצוב" : lang === "ru" ? "Размер дизайна" : "Design Size"}
                      <span style={{ color: COLORS.accent, fontWeight: 700, marginRight: 8, marginLeft: 8 }}>{Math.round((imagePos.size / 160) * 30)} cm</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setImagePos(p => ({ ...p, size: Math.max(43, p.size - 7) }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0, fontFamily: "'Varela Round',sans-serif" }}>−</button>
                      <input type="range" min={43} max={160} value={Math.min(160, Math.max(43, imagePos.size))} onChange={e => setImagePos(p => ({ ...p, size: Number(e.target.value) }))} style={{ flex: 1, accentColor: COLORS.accent, cursor: "pointer" }} />
                      <button onClick={() => setImagePos(p => ({ ...p, size: Math.min(160, p.size + 7) }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0, fontFamily: "'Varela Round',sans-serif" }}>+</button>
                    </div>
                  </div>
                )}
                {/* Desktop manual fine-tune — collapsible, same as mobile */}
                {!isMobile && uploadedImage && (
                  <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div onClick={() => setShowNudge(s => !s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", background: showNudge ? "rgba(255,107,53,0.08)" : COLORS.bgCard }}>
                      <label style={{ ...labelStyle, marginBottom: 0, cursor: "pointer" }}>
                        {lang === "he" ? "🎛️ כיוונון ידני" : lang === "ru" ? "🎛️ Ручная настройка" : "🎛️ Manual fine-tune"}
                      </label>
                      <span style={{ color: COLORS.gray, fontSize: 14 }}>{showNudge ? "▲" : "▼"}</span>
                    </div>
                    {showNudge && (
                      <div style={{ padding: "12px 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, width: 140, margin: "0 auto" }}>
                          <div />
                          <button onClick={() => nudge(0, -5)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>↑</button>
                          <div />
                          <button onClick={() => nudge(isRTL ? 5 : -5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>{isRTL ? "→" : "←"}</button>
                          <div style={{ background: COLORS.bg, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: COLORS.gray }}>✛</span></div>
                          <button onClick={() => nudge(isRTL ? -5 : 5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>{isRTL ? "←" : "→"}</button>
                          <div />
                          <button onClick={() => nudge(0, 5)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>↓</button>
                          <div />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Second design size slider — right below first */}
                {!isMobile && secondFront.enabled && secondFront.image && (
                  <div>
                    <label style={labelStyle}>
                      {lang === "he" ? "גודל עיצוב שני" : lang === "ru" ? "Размер 2-го дизайна" : "2nd Design Size"}
                      <span style={{ color: COLORS.accent, fontWeight: 700, marginRight: 8, marginLeft: 8 }}>{Math.round((secondFront.pos.size / 160) * 30)} cm</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setSecondFront(p => ({ ...p, pos: { ...p.pos, size: Math.max(43, p.pos.size - 7) } }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0, fontFamily: "'Varela Round',sans-serif" }}>−</button>
                      <input type="range" min={43} max={160} value={secondFront.pos.size} onChange={e => setSecondFront(p => ({ ...p, pos: { ...p.pos, size: Number(e.target.value) } }))} style={{ flex: 1, accentColor: COLORS.accent, cursor: "pointer" }} />
                      <button onClick={() => setSecondFront(p => ({ ...p, pos: { ...p.pos, size: Math.min(160, p.pos.size + 7) } }))} style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18, flexShrink: 0, fontFamily: "'Varela Round',sans-serif" }}>+</button>
                    </div>
                  </div>
                )}
                {/* Placement removed - users drag to position */}
                {/* Extra prints — shirts only */}
                {["tshirt","oversized","stonewash","dryfit"].includes(product.id) && (
                  <div>
                    <label style={labelStyle}>{lang === "he" ? "הדפסות נוספות" : lang === "ru" ? "Дополнительные принты" : "Additional Prints"}</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { key: "sf",  state: secondFront, setState: setSecondFront, ref: secondFileRef,  label: lang === "he" ? "עיצוב נוסף בחזית" : lang === "ru" ? "Дополнительный дизайн спереди" : "Second Front Design", price: SECOND_FRONT_PRICE, isSecondFront: true },
                        { key: "bp",  state: { enabled: backPrint, sameAsMain: backDesign.sameAsMain, image: backDesign.image }, setState: (fn) => { const v = fn({ enabled: backPrint, sameAsMain: backDesign.sameAsMain, image: backDesign.image }); setBackPrint(v.enabled); setBackDesign({ sameAsMain: v.sameAsMain, image: v.image }); }, ref: backFileRef, label: lang === "he" ? "הדפסה על הגב" : lang === "ru" ? "Принт на спине" : "Back Print", price: BACK_PRINT_PRICE },
                        { key: "sl",  state: sleeveLeft,  setState: setSleeveLeft,  ref: sleeveLeftRef,  label: lang === "he" ? "שרוול שמאל" : lang === "ru" ? "Левый рукав" : "Left Sleeve",  price: SLEEVE_PRICE },
                        { key: "sr",  state: sleeveRight, setState: setSleeveRight, ref: sleeveRightRef, label: lang === "he" ? "שרוול ימין" : lang === "ru" ? "Правый рукав" : "Right Sleeve", price: SLEEVE_PRICE },
                      ].map(({ key, state, setState, ref, label, price, isSecondFront }) => (
                        <div key={key} style={{ background: state.enabled ? "rgba(255,107,53,0.08)" : COLORS.bgCard, border: `1px solid ${state.enabled ? COLORS.accent : COLORS.border}`, borderRadius: 10, overflow: "hidden", transition: "all 0.2s" }}>
                          <div onClick={() => {
                            const newEnabled = !state.enabled;
                            setState(p => ({ ...p, enabled: newEnabled }));
                            if (isSecondFront && newEnabled && product) {
                              // Reset position but DON'T switch activeDesign yet (wait for image)
                              const pa = product.printArea;
                              setSecondFront(p => ({ ...p, enabled: true, pos: { x: pa.x + 10, y: pa.y + 10, size: imagePos.size } }));
                            }
                            if (isSecondFront && !newEnabled) {
                              setActiveDesign('main');
                              setSecondFront(p => ({ ...p, enabled: false, image: null, sameAsMain: true }));
                            }
                          }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }}>
                            <span style={{ color: COLORS.white, fontSize: 13, fontWeight: 600 }}>{label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 13 }}>+₪{price}</span>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: state.enabled ? COLORS.accent : "transparent", border: `2px solid ${state.enabled ? COLORS.accent : COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {state.enabled && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                              </div>
                            </div>
                          </div>
                          {state.enabled && (
                            <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${COLORS.border}` }}>
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <button onClick={() => {
                                  setState(p => ({ ...p, sameAsMain: true, image: null }));
                                  if (isSecondFront) {
                                    // Copy main design image and size
                                    setSecondFront(p => ({ ...p, sameAsMain: true, image: uploadedImage, pos: { ...p.pos, size: imagePos.size } }));
                                    setActiveDesign('second');
                                  }
                                }} style={{ flex: 1, background: state.sameAsMain ? COLORS.accent : COLORS.bgCard, border: `1px solid ${state.sameAsMain ? COLORS.accent : COLORS.border}`, color: state.sameAsMain ? "#fff" : COLORS.gray, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif" }}>
                                  {lang === "he" ? "אותו עיצוב" : lang === "ru" ? "Тот же дизайн" : "Same design"}
                                </button>
                                <button onClick={() => { setState(p => ({ ...p, sameAsMain: false })); ref.current?.click(); }} style={{ flex: 1, background: !state.sameAsMain ? COLORS.accent : COLORS.bgCard, border: `1px solid ${!state.sameAsMain ? COLORS.accent : COLORS.border}`, color: !state.sameAsMain ? "#fff" : COLORS.gray, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif" }}>
                                  {lang === "he" ? "העלה עיצוב שונה" : lang === "ru" ? "Загрузить другой" : "Upload different"}
                                </button>
                              </div>
                              {!state.sameAsMain && state.image && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                  <img src={state.image} alt={lang === "he" ? "תצוגה מקדימה של עיצוב" : lang === "ru" ? "Предпросмотр дизайна" : "Design preview"} style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, border: `1px solid ${COLORS.border}` }} />
                                  <span style={{ color: COLORS.accent, fontSize: 12 }}>✓ {lang === "he" ? "עיצוב הועלה" : "Uploaded"}</span>
                                </div>
                              )}
                              <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleExtraUpload(e, setState, isSecondFront)} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Notes */}
                <div>
                  <label htmlFor="order-notes-design" style={labelStyle}>{t.form.notes}</label>
                  <textarea id="order-notes-design" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t.form.notesPh} rows={2} style={{ width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 13, outline: "none", resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
                {variant && <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 14, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{product.name}</span><span>₪{variant.price}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{t.customize.shipping}</span><span>₪{shippingPrice}</span></div>
                  {backPrint && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.accent, fontSize: 13, marginBottom: 6 }}><span>{lang === "he" ? "גב" : "Back"}</span><span>+₪{BACK_PRINT_PRICE}</span></div>}
                  {secondFront.enabled && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.accent, fontSize: 13, marginBottom: 6 }}><span>{lang === "he" ? "עיצוב נוסף בחזית" : "2nd Front"}</span><span>+₪{SECOND_FRONT_PRICE}</span></div>}
                  {sleeveLeft.enabled && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.accent, fontSize: 13, marginBottom: 6 }}><span>{lang === "he" ? "שרוול שמאל" : "Left Sleeve"}</span><span>+₪{SLEEVE_PRICE}</span></div>}
                  {sleeveRight.enabled && <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.accent, fontSize: 13, marginBottom: 6 }}><span>{lang === "he" ? "שרוול ימין" : "Right Sleeve"}</span><span>+₪{SLEEVE_PRICE}</span></div>}
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.white, fontWeight: 600 }}>{t.customize.total}</span><span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>₪{total}</span></div>
                </div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
              <button onClick={() => safeGo(() => setStep(1))} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.customize.back}</button>
              <button onClick={() => uploadedImage && setShowNextChoice(true)} disabled={!uploadedImage} style={{ flex: 1, background: uploadedImage ? COLORS.accent : COLORS.bgCard, color: uploadedImage ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, cursor: uploadedImage ? "pointer" : "not-allowed", fontFamily: "'Varela Round',sans-serif" }}>
                {lang === "he" ? "המשך →" : lang === "ru" ? "Продолжить →" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 0 : 28,
            // alignItems: 'stretch' (the default) is REQUIRED here so the sidebar
            // wrapper grows to match the form column's height. The OrderSummary
            // inside uses position: sticky — for that to have slide room, its
            // parent (the wrapper) must be TALLER than it is. flex-start would
            // collapse the wrapper to the summary's own height and kill sticky.
            alignItems: "stretch",
          }}>
            {/* Mobile: collapsible summary at the very top of the form column */}
            {isMobile && <OrderSummary lang={lang} cart={cart} setCart={setCart} updateCartQty={updateCartQty} isMobile={true} shippingPrice={shippingPrice} />}

            {/* Form column — wider on desktop (flex 1.5 vs sidebar's 1) */}
            <div style={{ flex: isMobile ? "none" : "1.5", width: "100%", minWidth: 0 }}>
            <h1 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.form.title}</h1>
            {submitError && <div role="alert" style={{ color: "#f87171", fontSize: 14, margin: "8px 0 16px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", padding: "12px 16px", borderRadius: 10 }}>{submitError}</div>}
            <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.form.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div><label htmlFor="order-name" style={labelStyle}>{t.form.name}</label><input id="order-name" type="text" value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (fieldErrors.name) setFieldErrors(fe => ({ ...fe, name: undefined })); }} placeholder={t.form.namePh} aria-invalid={!!fieldErrors.name} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />{fieldErrors.name && <div role="alert" style={fieldErrStyle}>{fieldErrors.name}</div>}</div>
              <div><label htmlFor="order-email" style={labelStyle}>{t.form.email}</label><input id="order-email" type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); if (fieldErrors.email) setFieldErrors(fe => ({ ...fe, email: undefined })); }} placeholder={t.form.emailPh} aria-invalid={!!fieldErrors.email} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />{fieldErrors.email && <div role="alert" style={fieldErrStyle}>{fieldErrors.email}</div>}</div>
              <div>
                <label htmlFor="order-phone" style={labelStyle}>{`${t.form.phone} *`}</label>
                <div role="group" aria-label={t.form.phone} style={{ display: "flex", flexWrap: "wrap", gap: 6, direction: "ltr", marginBottom: 10 }}>
                  {IL_PREFIXES.map(pf => <button key={pf.value} type="button" aria-pressed={form.phonePrefix === pf.value} onClick={() => setForm(p => ({ ...p, phonePrefix: pf.value }))} style={{ background: form.phonePrefix === pf.value ? "rgba(255,107,53,0.15)" : "#1a1a1a", border: `1px solid ${form.phonePrefix === pf.value ? "#FF6B35" : "#2a2a2a"}`, color: form.phonePrefix === pf.value ? "#FF6B35" : "#888", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Varela Round',sans-serif", transition: "all 0.15s" }}>{pf.value}</button>)}
                </div>
                <input id="order-phone" type="tel" placeholder={t.form.phonePh} value={form.phoneNumber} maxLength={7} onChange={e => { setForm(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") })); if (fieldErrors.phone) setFieldErrors(fe => ({ ...fe, phone: undefined })); }} aria-required="true" aria-invalid={!!fieldErrors.phone} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
                {fieldErrors.phone && <div role="alert" style={fieldErrStyle}>{fieldErrors.phone}</div>}
              </div>
              <div style={{ position: "relative" }}>
                <label htmlFor="order-street" style={labelStyle}>{lang === "he" ? "כתובת מלאה — רחוב ומספר" : lang === "ru" ? "Адрес — улица и номер" : "Address — Street & number"}</label>
                <input type="text" value={form.street} id="order-street" aria-invalid={!!fieldErrors.street} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, street: v })); if (fieldErrors.street) setFieldErrors(fe => ({ ...fe, street: undefined })); fetchAddrSuggestions(`${v}${form.city ? `, ${form.city}` : ", Israel"}`); }}
                  onKeyDown={e => { if (e.key === "Escape") setShowAddrSugg(false); }}
                  onBlur={e => { if (e.relatedTarget && e.relatedTarget.classList && e.relatedTarget.classList.contains("addr-sugg-item")) return; setTimeout(() => setShowAddrSugg(false), 200); }}
                  placeholder={lang === "he" ? "לדוגמה: הרצל 15" : lang === "ru" ? "Например: Герцль 15" : "e.g. Herzl 15"} style={inputStyle} autoComplete="off" role="combobox" aria-expanded={showAddrSugg && addrSuggestions.length > 0} aria-controls="addr-suggestions" aria-autocomplete="list" />
                {addrLoading && <><span aria-hidden="true" style={{ position: "absolute", insetInlineStart: 14, top: 38, color: COLORS.gray, fontSize: 11 }}>⏳</span><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }} role="status">{lang === "he" ? "טוען הצעות כתובת" : lang === "ru" ? "Загрузка вариантов адреса" : "Loading address suggestions"}</span></>}
                {showAddrSugg && addrSuggestions.length > 0 && (
                  <div id="addr-suggestions" role="listbox" aria-label={lang === "he" ? "הצעות כתובת" : lang === "ru" ? "Варианты адреса" : "Address suggestions"} style={{ position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, background: COLORS.bgCard, border: `1px solid ${COLORS.accent}`, borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                    {addrSuggestions.map((s, i) => (
                      <button type="button" className="addr-sugg-item" role="option" aria-selected="false" key={i}
                        onClick={() => selectAddress(s)}
                        onKeyDown={e => { if (e.key === "Escape") { setShowAddrSugg(false); const el = document.getElementById("order-street"); if (el) el.focus(); } }}
                        style={{ display: "block", width: "100%", textAlign: lang === "he" ? "right" : "left", background: "transparent", padding: "10px 14px", cursor: "pointer", color: COLORS.white, fontSize: 13, border: "none", borderBottom: i < addrSuggestions.length - 1 ? `1px solid ${COLORS.border}` : "none", fontFamily: "'Varela Round',sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,107,53,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"} onFocus={e => e.currentTarget.style.background = "rgba(255,107,53,0.1)"} onBlur={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ color: COLORS.accent, fontWeight: 600 }}>{s.display_name.split(",").slice(0, 2).join(",")}</div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{s.display_name.split(",").slice(2).join(",").trim()}</div>
                      </button>
                    ))}
                  </div>
                )}
                {fieldErrors.street && <div role="alert" style={fieldErrStyle}>{fieldErrors.street}</div>}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                  <label htmlFor="order-city" style={labelStyle}>{lang === "he" ? "עיר" : lang === "ru" ? "Город" : "City"}</label>
                  <input id="order-city" type="text" value={form.city} onChange={e => { setForm(p => ({ ...p, city: e.target.value })); if (fieldErrors.city) setFieldErrors(fe => ({ ...fe, city: undefined })); }} placeholder={lang === "he" ? "תל אביב" : lang === "ru" ? "Тель-Авив" : "Tel Aviv"} aria-invalid={!!fieldErrors.city} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />{fieldErrors.city && <div role="alert" style={fieldErrStyle}>{fieldErrors.city}</div>}
                </div>
                <div style={{ flex: "1 1 140px", minWidth: 140 }}>
                  <label htmlFor="order-postal" style={labelStyle}>{lang === "he" ? "מיקוד" : lang === "ru" ? "Индекс" : "Postal Code"}</label>
                  <input id="order-postal" type="text" value={form.postalCode} maxLength={7} onChange={e => { setForm(p => ({ ...p, postalCode: e.target.value.replace(/\D/g, "") })); if (fieldErrors.postal) setFieldErrors(fe => ({ ...fe, postal: undefined })); }} placeholder="1234567" aria-invalid={!!fieldErrors.postal} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />{fieldErrors.postal && <div role="alert" style={fieldErrStyle}>{fieldErrors.postal}</div>}
                </div>
              </div>
              {/* Shipping method — Locker (cheaper, pickup-point) vs Home
                  (door-to-door courier). Persisted onto every order row via
                  extra_prints.shipping_method; the chosen rate feeds the
                  totals via shippingPrice (above). */}
              <div>
                <label id="shipping-method-label" style={labelStyle}>
                  {lang === `he` ? `שיטת משלוח` : lang === `ru` ? `Способ доставки` : `Shipping method`}
                </label>
                <div role="group" aria-labelledby="shipping-method-label" style={{ display: `flex`, gap: 10, flexWrap: `wrap` }}>
                  {[
                    { id: `locker`, price: SHIPPING_LOCKER, label_he: `נקודת איסוף`, label_en: `Pickup locker`, label_ru: `Пункт выдачи`, sub_he: `מהיר וזול`, sub_en: `Fast & affordable`, sub_ru: `Быстро и дёшево` },
                    { id: `home`, price: SHIPPING_HOME, label_he: `שליח עד הבית`, label_en: `Home delivery`, label_ru: `Курьер на дом`, sub_he: `נוחות מקסימלית`, sub_en: `Door to door`, sub_ru: `Прямо к двери` },
                  ].map(opt => {
                    const active = shippingMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setShippingMethod(opt.id)}
                        style={{
                          flex: `1 1 160px`,
                          background: active ? `rgba(255,107,53,0.1)` : COLORS.bgCard,
                          border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                          color: COLORS.white,
                          borderRadius: 10,
                          padding: `12px 14px`,
                          textAlign: `start`,
                          cursor: `pointer`,
                          fontFamily: `'Varela Round',sans-serif`,
                          transition: `border-color 0.2s, background 0.2s`,
                        }}>
                        <div style={{ display: `flex`, justifyContent: `space-between`, alignItems: `center`, gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{opt[`label_${lang}`] || opt.label_en}</span>
                          <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 14 }}>{`₪${opt.price}`}</span>
                        </div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 4 }}>{opt[`sub_${lang}`] || opt.sub_en}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div><label htmlFor="order-notes" style={labelStyle}>{t.form.notes}</label><textarea id="order-notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t.form.notesPh} rows={3} style={{ ...inputStyle, resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div style={{ background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.2)`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>{t.form.paymentNote}</div>
                <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 4 }}>{t.form.paymentSub}</div>
              </div>
            </div>
            {(() => {
              // Only surface the "missing fields" hint once the user has started
              // filling the form — not on first load before any interaction. The
              // disabled submit button is the pre-interaction guide.
              const formDirty = !!(form.name || form.email || form.phoneNumber || form.street || form.city || form.postalCode || form.notes);
              const missing = [];
              if (!form.name) missing.push(lang === "he" ? "שם" : lang === "ru" ? "Имя" : "Name");
              if (!form.email) missing.push(lang === "he" ? "אימייל" : lang === "ru" ? "Email" : "Email");
              if (!form.phoneNumber || form.phoneNumber.length !== 7) missing.push(lang === "he" ? "טלפון (7 ספרות)" : lang === "ru" ? "Телефон (7 цифр)" : "Phone (7 digits)");
              if (!form.street) missing.push(lang === "he" ? "כתובת" : lang === "ru" ? "Адрес" : "Address");
              if (!form.city) missing.push(lang === "he" ? "עיר" : lang === "ru" ? "Город" : "City");
              if (!form.postalCode) missing.push(lang === "he" ? "מיקוד" : lang === "ru" ? "Индекс" : "Postal Code");
              if (!formDirty || missing.length === 0) return null;
              return (
                <div style={{ background: "rgba(255,107,53,0.1)", border: `1px solid ${COLORS.accent}`, borderRadius: 8, padding: "12px 14px", marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      {lang === "he" ? "שדות חסרים למילוי:" : lang === "ru" ? "Необходимо заполнить:" : "Please fill in:"}
                    </div>
                    <div style={{ color: COLORS.white, fontSize: 13, lineHeight: 1.6 }}>{missing.join(" · ")}</div>
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(product ? 2 : 1)} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.form.back}</button>
              <button onClick={handleSubmit} disabled={!form.name || !form.email || !form.phoneNumber || form.phoneNumber.length !== 7 || !form.street || !form.city || !form.postalCode || submitting} style={{ flex: 1, background: (form.name && form.email && form.phoneNumber && form.phoneNumber.length === 7 && form.street && form.city && form.postalCode) ? COLORS.accent : COLORS.bgCard, color: (form.name && form.email && form.phoneNumber && form.phoneNumber.length === 7 && form.street && form.city && form.postalCode) ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: (form.name && form.email && form.phoneNumber && form.phoneNumber.length === 7 && form.street && form.city && form.postalCode) ? "pointer" : "not-allowed", fontFamily: "'Varela Round',sans-serif" }}>
                {submitting ? "..." : `${t.form.place} · ₪${total}`}
              </button>
            </div>
            </div>

            {/* Desktop sticky summary column */}
            {!isMobile && (
              <div style={{ flex: "1", width: "100%", minWidth: 280, maxWidth: 360 }}>
                <OrderSummary lang={lang} cart={cart} setCart={setCart} updateCartQty={updateCartQty} isMobile={false} shippingPrice={shippingPrice} />
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(255,107,53,0.12)", border: `2px solid ${COLORS.accent}`, marginBottom: 16 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={COLORS.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h1 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 34, marginBottom: 6 }}>{t.payment.title}</h1>
              {submitError && <div role="alert" style={{ color: "#f87171", fontSize: 14, margin: "10px 0", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.4)", padding: "12px 16px", borderRadius: 10 }}>{submitError}</div>}
              <p style={{ color: COLORS.gray, fontSize: 15 }}>{t.payment.subtitle}</p>
            </div>

            {/* Order number */}
            {pendingOrderGroupId && (
              <div style={{ background: "rgba(255,107,53,0.06)", border: `1px solid rgba(255,107,53,0.25)`, borderRadius: 10, padding: "10px 16px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ color: COLORS.gray, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{t.payment.orderNum}</div>
                <div style={{ color: COLORS.accent, fontSize: 16, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", letterSpacing: "0.05em" }}>{`SXP-${pendingOrderGroupId.slice(-8).toUpperCase()}`}</div>
              </div>
            )}

            {/* Order summary card */}
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "22px 22px 20px", marginBottom: 18 }}>
              <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 15, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{t.payment.summary}</span>
                <span style={{ color: COLORS.gray, fontSize: 12, fontWeight: 400 }}>{cart.length} {lang === "he" ? "פריטים" : lang === "ru" ? "товаров" : "items"}</span>
              </div>
              {cart.map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1, paddingInlineEnd: 12 }}>
                    <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14 }}>{it.productName} × {it.qty}</div>
                    <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
                      {it.variantLabel}
                      {it.backPrint ? ` · ${lang === "he" ? "הדפס אחורי" : lang === "ru" ? "Спина" : "Back print"}` : ""}
                      {it.secondFront.enabled ? ` · ${lang === "he" ? "הדפס נוסף" : lang === "ru" ? "Доп. перед" : "Extra front"}` : ""}
                      {it.sleeveLeft.enabled ? ` · ${lang === "he" ? "שרוול שמאל" : lang === "ru" ? "Левый рукав" : "Left sleeve"}` : ""}
                      {it.sleeveRight.enabled ? ` · ${lang === "he" ? "שרוול ימין" : lang === "ru" ? "Правый рукав" : "Right sleeve"}` : ""}
                    </div>
                  </div>
                  <span style={{ color: COLORS.white, fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>₪{it.itemPrice}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}>
                  <span>{t.payment.subtotal}</span>
                  <span>₪{cartItemsTotal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 12 }}>
                  <span>{t.payment.shipping}</span>
                  <span>₪{shippingPrice}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.white, fontWeight: 700, fontSize: 15 }}>{t.payment.total}</span>
                  <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 26, fontFamily: "'Playfair Display',serif" }}>₪{pendingTotal}</span>
                </div>
              </div>
            </div>

            {/* Delivery address */}
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 24 }}>
              <div style={{ color: COLORS.gray, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>{t.payment.deliveryTo}</div>
              <div style={{ color: COLORS.white, fontSize: 14, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600 }}>{form.name}</div>
                <div style={{ color: "#ccc" }}>{form.street}, {form.city} {form.postalCode}</div>
                <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 2 }}>{form.phonePrefix}-{form.phoneNumber}</div>
                <div style={{ color: COLORS.gray, fontSize: 13 }}>{form.email}</div>
              </div>
            </div>

            {/* Pay button - the most prominent element. Behavior is gated by
                the global PAYMENTS_ENABLED flag (near MAINTENANCE_MODE): when
                off, we show the existing "coming soon" modal (order rows are
                already inserted in step 3, so the customer experience stays
                graceful); when on, we call the create-payment edge function
                and redirect to Tranzila. */}
            <MagneticButton
              block
              strength={0.25}
              radius={24}
              onClick={async () => {
                if (!PAYMENTS_ENABLED) {
                  setShowPaymentSoonModal(true);
                  return;
                }
                if (paymentProcessing) return;
                setPaymentProcessing(true);
                try {
                  // items_summary is a short free-text description on the
                  // Tranzila page (60 chars max per the edge function), not a
                  // line-items array. Build something humanish like
                  // "BLOOM Luna shirt · Mug · Sticker (3 items)".
                  const titles = cart.map(it => it?.title || it?.characterName || ``).filter(Boolean);
                  const headline = titles.slice(0, 2).join(` · `) || `Sfalim order`;
                  const overflow = cart.length > 2 ? ` (+${cart.length - 2})` : ``;
                  const itemsSummary = `${headline}${overflow}`;
                  const { data, error } = await supabase.functions.invoke(`create-payment`, {
                    body: {
                      // The deployed edge function accepts either order_group
                      // (text key shared by all rows in this checkout) or
                      // order_id (uuid). pendingOrderGroupId is the text key.
                      order_group: pendingOrderGroupId,
                      amount: pendingTotal,
                      currency: `ILS`,
                      customer: {
                        name: form.name,
                        email: form.email,
                        phone: `${form.phonePrefix}-${form.phoneNumber}`,
                      },
                      items_summary: itemsSummary,
                    },
                  });
                  // Supabase client returns 503 errors as FunctionsHttpError;
                  // we want to land back on the existing "coming soon" UX
                  // (which is graceful, since the order rows are already
                  // saved; no email is sent until payment is confirmed) instead
                  // of an alert.
                  if (error) {
                    const code = String(error.message || ``).toLowerCase();
                    if (code.includes(`payments_disabled`) || code.includes(`503`)) {
                      setPaymentProcessing(false);
                      setShowPaymentSoonModal(true);
                      return;
                    }
                    throw error;
                  }
                  if (data && data.redirect_url) {
                    window.location.href = data.redirect_url;
                    return;
                  }
                  throw new Error(`No redirect_url returned from create-payment`);
                } catch (e) {
                  console.error(`[pay] create-payment failed:`, e);
                  setPaymentProcessing(false);
                  setSubmitError(uiPaymentError(lang));
                }
              }}
              disabled={paymentProcessing}
              style={{
                width: "100%",
                background: paymentProcessing ? COLORS.bgCard : `linear-gradient(135deg, ${COLORS.accentBtn} 0%, #A8461A 100%)`,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "20px 24px",
                fontSize: 17,
                fontWeight: 700,
                cursor: paymentProcessing ? "not-allowed" : "pointer",
                fontFamily: "'Varela Round',sans-serif",
                boxShadow: paymentProcessing ? "none" : "0 8px 24px rgba(255,107,53,0.4)",
                transition: "background 0.2s, box-shadow 0.3s",
                marginBottom: 18,
                letterSpacing: "0.02em",
                display: "block",
              }}
            >
              {paymentProcessing ? t.payment.processing : `${t.payment.payBtn}₪${pendingTotal}${t.payment.paySuffix}`}
            </MagneticButton>

            {/* Trust signals row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { text: t.payment.trustFast },
                { text: t.payment.trustSSL },
                { text: t.payment.trustReturn },
                { text: t.payment.trustNoSave },
              ].map((badge, i) => (
                <div key={i} className="trust-badge" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "default" }}>
                  <span className="badge-icon" style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, display: "inline-block", flexShrink: 0, boxShadow: `0 0 8px rgba(255,107,53,0.4)` }}></span>
                  <span style={{ color: COLORS.gray, fontSize: 11.5, lineHeight: 1.3 }}>{badge.text}</span>
                </div>
              ))}
            </div>

            {/* Secured by + accepted cards */}
            <div style={{ textAlign: "center", padding: "16px 0", borderTop: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
              <div style={{ color: COLORS.gray, fontSize: 12, marginBottom: 6, letterSpacing: "0.05em" }}>
                {t.payment.securedBy} <span style={{ color: COLORS.white, fontWeight: 600 }}>Tranzila</span>
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 11, letterSpacing: "0.05em" }}>
                {t.payment.acceptedCards} VISA · Mastercard · Bit · Apple Pay · Google Pay
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 10.5, marginTop: 6 }}>
                {t.payment.businessLine}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                onClick={() => setStep(3)}
                disabled={paymentProcessing}
                style={{ flex: 1, background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", fontSize: 13, cursor: paymentProcessing ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif" }}
              >
                {t.payment.editDetails}
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(t.payment.confirmCancel)) return;
                  setPaymentProcessing(true);
                  try {
                    if (pendingOrderIds.length > 0) {
                      await supabase.from("orders").update({
                        status: "cancelled",
                        payment_status: "cancelled",
                        cancelled_at: new Date().toISOString(),
                      }).in("id", pendingOrderIds);
                    }
                    setPendingOrderGroupId(null);
                    setPendingOrderIds([]);
                    setCart([]);
                    setStep(1);
                    setSelectedProduct(null);
                    setUploadedImage(null);
                  } catch (e) {
                    console.error(`[cancel-order] failed:`, e);
                    setSubmitError(uiGenericError(lang));
                  }
                  setPaymentProcessing(false);
                }}
                disabled={paymentProcessing}
                style={{ background: "transparent", color: "#888", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", fontSize: 13, cursor: paymentProcessing ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif" }}
              >
                {t.payment.cancel}
              </button>
            </div>

            {/* Payment-coming-soon modal */}
            {showPaymentSoonModal && (typeof document !== `undefined` ? createPortal(
              <div
                onClick={(e) => { if (e.target === e.currentTarget) dismissPaymentSoonModal(); }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, backdropFilter: "blur(4px)" }}
              >
                <div ref={paySoonRef} role="dialog" aria-modal="true" aria-label={t.payment.soonTitle} style={{ position: "relative", background: "#1a1a1a", border: `1px solid ${COLORS.accent}`, borderRadius: 16, padding: "36px 32px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(255,107,53,0.2)" }}>
                  <button
                    onClick={dismissPaymentSoonModal}
                    aria-label={LANGS[lang].bloom.closeModal}
                    style={{ position: "absolute", top: 12, insetInlineEnd: 12, width: 32, height: 32, borderRadius: "50%", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, cursor: "pointer", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Varela Round',sans-serif" }}
                  >
                    ×
                  </button>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: COLORS.accent, display: "inline-block", boxShadow: `0 0 30px rgba(255,107,53,0.7)`, animation: "maintPulse 2s ease-in-out infinite" }}></span>
                  </div>
                  <h3 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 14 }}>{t.payment.soonTitle}</h3>
                  <p style={{ color: COLORS.gray, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{t.payment.soonSub}</p>
                  <div style={{ background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.25)`, borderRadius: 10, padding: "12px 16px", marginBottom: 24, textAlign: "start" }}>
                    <div style={{ color: COLORS.gray, fontSize: 11, marginBottom: 4 }}>{t.payment.orderNum}</div>
                    <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>{pendingOrderGroupId ? `SXP-${pendingOrderGroupId.slice(-8).toUpperCase()}` : ""}</div>
                  </div>
                  <button
                    onClick={dismissPaymentSoonModal}
                    style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", width: "100%" }}
                  >
                    {t.payment.soonBtn}
                  </button>
                </div>
              </div>
            , document.body) : null)}
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: "center", padding: "20px 0 60px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: "50%", background: submittedForApproval ? "rgba(255,107,53,0.12)" : "rgba(34,197,94,0.12)", border: `2px solid ${submittedForApproval ? COLORS.accent : "#22c55e"}`, marginBottom: 24, fontSize: 44 }}>{submittedForApproval ? "🎨" : "✓"}</div>
            <h1 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 8 }}>{submittedForApproval ? t.approval.submittedTitle : t.confirm.title}</h1>
            <p style={{ color: COLORS.gray, fontSize: 15, marginBottom: 24 }}>{t.confirm.subtitle}</p>

            {submittedForApproval && (
              <div style={{ background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.35)`, borderRadius: 12, padding: "16px 20px", maxWidth: 520, margin: "0 auto 24px", color: COLORS.white, fontSize: 14.5, lineHeight: 1.7 }}>
                {t.approval.submittedDesc}
              </div>
            )}

            {pendingOrderGroupId && (
              <div style={{ display: "inline-block", background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 10, padding: "10px 20px", marginBottom: 28 }}>
                <span style={{ color: COLORS.gray, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginInlineEnd: 8 }}>{t.confirm.orderNum}</span>
                <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>{`SXP-${pendingOrderGroupId.slice(-8).toUpperCase()}`}</span>
              </div>
            )}

            <p style={{ color: COLORS.gray, fontSize: 15, maxWidth: 460, margin: "0 auto 36px", lineHeight: 1.7 }}>
              {t.confirm.thanksLine.replace("{name}", form.name)} <span style={{ color: COLORS.accent, fontWeight: 600 }}>{form.email}</span>
            </p>

            {/* What's next - timeline */}
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "24px 22px", marginBottom: 28, textAlign: "start", maxWidth: 520, margin: "0 auto 28px" }}>
              <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 15, marginBottom: 18, textAlign: "center", letterSpacing: "0.05em" }}>{t.confirm.whatsNext}</div>
              {[
                { num: "1", title: t.confirm.step1Title, sub: t.confirm.step1Sub },
                { num: "2", title: t.confirm.step2Title, sub: t.confirm.step2Sub },
                { num: "3", title: t.confirm.step3Title, sub: t.confirm.step3Sub },
                { num: "4", title: t.confirm.step4Title, sub: t.confirm.step4Sub },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: i === 3 ? 0 : 16, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,107,53,0.15)", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{s.num}</div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.title}</div>
                    <div style={{ color: COLORS.gray, fontSize: 12.5, lineHeight: 1.5 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Optional, skippable account offer — guests only */}
            {!user && showAccountOffer && (
              <div style={{ background: COLORS.bgCard, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 14, padding: "22px 20px", maxWidth: 520, margin: "0 auto 28px", textAlign: "center" }}>
                {accountSent ? (
                  <div style={{ color: COLORS.success, fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>{t.auth.magicLinkSent}</div>
                ) : (
                  <>
                    <div style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{t.confirm.accountTitle}</div>
                    <div style={{ color: COLORS.gray, fontSize: 13.5, lineHeight: 1.6, maxWidth: 380, margin: "0 auto 18px" }}>{t.confirm.accountDesc}</div>
                    {accountError && <div style={{ color: "#f87171", fontSize: 12.5, marginBottom: 12 }}>{accountError}</div>}
                    <button type="button" onClick={handleGoogleSignup} disabled={accountBusy} style={{ width: "100%", background: "#fff", color: "#1a1a1a", border: "1px solid #fff", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: accountBusy ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: accountBusy ? 0.6 : 1 }}
                      onMouseOver={e => { if (!accountBusy) e.currentTarget.style.background = "#f0f0f0"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "#fff"; }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {t.auth.googleBtn}
                    </button>
                    <button type="button" onClick={handleAccountMagicLink} disabled={accountBusy} style={{ display: "block", margin: "14px auto 0", background: "transparent", border: "none", color: COLORS.accent, fontSize: 13, fontWeight: 600, cursor: accountBusy ? "not-allowed" : "pointer", fontFamily: "'Varela Round',sans-serif", padding: 4 }}>{t.auth.magicLink}</button>
                    <button type="button" onClick={() => setShowAccountOffer(false)} style={{ display: "block", margin: "6px auto 0", background: "transparent", border: "none", color: COLORS.gray, fontSize: 13, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", padding: 4 }}>{t.confirm.accountLater}</button>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {user && <button onClick={() => setPage("track")} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.track} →</button>}
              <button onClick={() => { setStep(1); setSelectedProduct(null); setUploadedImage(null); setForm({ name: "", email: "", phonePrefix: "050", phoneNumber: "", street: "", city: "", postalCode: "", notes: "" }); setQty(1); setPendingOrderGroupId(null); setPendingOrderIds([]); setPendingTotal(0); setSubmittedForApproval(false); }} style={{ background: "transparent", color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "14px 28px", fontSize: 15, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.another}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hero

// ============ COOKIE CONSENT — premium, Hebrew-first, brand-matching ============
function CookieConsent({ lang, onAccept, onReject }) {
  const isRTL = lang === "he";
  // On phones the floating, side-inset card sat mid-air over the hero's lower
  // content (and on top of the two corner FABs). Pin it flush to the bottom edge
  // as a full-width bar there (rounded top corners only) so it reads as a clear
  // bottom consent bar and stops overlapping hero content.
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  // A11y: move focus to the banner when it appears so keyboard users find it,
  // and let Escape dismiss it (treated as "decline" / essential-only).
  const regionRef = useRef(null);
  useEffect(() => { regionRef.current && regionRef.current.focus(); }, []);
  const onKeyDown = (e) => { if (e.key === "Escape") { e.stopPropagation(); onReject(); } };
  const t = {
    he: {
      title: "פרטיות",
      body: "האתר משתמש בקבצי Cookie לניתוח שימוש ולשיפור החוויה. בלחיצה על \"אישור\" אתם מסכימים לשימוש בעוגיות אנליטיקה. תוכלו לדחות ולהשתמש באתר ללא עוגיות עזר.",
      accept: "אישור הכל",
      reject: "חיוניים בלבד",
      more: "פרטים נוספים",
    },
    en: {
      title: "Privacy",
      body: "This site uses cookies to analyze usage and improve your experience. By clicking \"Accept\", you consent to analytics cookies. You can decline and use the site with essential cookies only.",
      accept: "Accept all",
      reject: "Essential only",
      more: "Learn more",
    },
    ru: {
      title: "Конфиденциальность",
      body: "Сайт использует файлы cookie для аналитики и улучшения опыта. Нажимая «Принять», вы соглашаетесь с использованием аналитических cookie. Вы можете отказаться и продолжить с базовыми cookie.",
      accept: "Принять всё",
      reject: "Только необходимые",
      more: "Подробнее",
    },
  }[lang] || {
    title: "Privacy", body: "", accept: "Accept", reject: "Decline", more: "Learn more",
  };

  return (
    <div ref={regionRef} tabIndex={-1} onKeyDown={onKeyDown} role="region" aria-label={lang === "he" ? "הסכמת קובצי Cookie" : lang === "ru" ? "Согласие на использование cookie" : "Cookie consent"} style={{
      outline: "none",
      position: "fixed",
      bottom: isMobile ? 0 : 16,
      left: isMobile ? 0 : 16,
      right: isMobile ? 0 : 16,
      maxWidth: isMobile ? "none" : 720,
      margin: isMobile ? 0 : "0 auto",
      background: "rgba(15,15,15,0.96)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,107,53,0.25)",
      borderRadius: isMobile ? "16px 16px 0 0" : 16,
      padding: isMobile ? "18px 18px calc(18px + env(safe-area-inset-bottom))" : "20px 24px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,107,53,0.08)",
      zIndex: 9999,
      direction: isRTL ? "rtl" : "ltr",
      animation: "cookieRise 0.5s cubic-bezier(.2,.7,.2,1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B35", boxShadow: "0 0 12px rgba(255,107,53,0.6)" }}></span>
        <div style={{ color: "#FF6B35", fontFamily: "'Playfair Display',serif", fontSize: 14, fontStyle: "italic", letterSpacing: "0.5px" }}>{t.title}</div>
      </div>
      <p style={{ color: "#bbb", fontFamily: "'Varela Round',sans-serif", fontSize: 13, lineHeight: 1.65, marginBottom: 10, marginTop: 0 }}>
        {t.body}
      </p>
      <p style={{ marginTop: 0, marginBottom: 16 }}>
        <a href="#policies/privacy" style={{ color: "#FF6B35", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>{t.more}</a>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isRTL ? "flex-start" : "flex-end" }}>
        <button onClick={onReject} style={{
          background: "transparent",
          border: "1px solid #333",
          color: "#888",
          padding: "10px 18px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Varela Round',sans-serif",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
        onMouseOver={e => { e.currentTarget.style.color = "#ccc"; e.currentTarget.style.borderColor = "#555"; }}
        onMouseOut={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "#333"; }}
        >{t.reject}</button>
        <button onClick={onAccept} style={{
          background: "#FF6B35",
          border: "1px solid #FF6B35",
          color: "#fff",
          padding: "10px 22px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Varela Round',sans-serif",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(255,107,53,0.35)",
          transition: "all 0.2s",
          letterSpacing: "0.3px",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "#ff8255"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#FF6B35"; }}
        >{t.accept}</button>
      </div>
    </div>
  );
}

// ============ MAGNETIC BUTTON — premium CTA with cursor attraction ============
function MagneticButton({ children, strength = 0.3, radius = 28, style, className, block = false, ...props }) {
  const buttonRef = useRef(null);
  const zoneRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip on touch devices and reduced-motion
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const zone = zoneRef.current;
    const btn = buttonRef.current;
    if (!zone || !btn) return;

    let rafId = null;
    let lastEvent = null;

    const update = () => {
      rafId = null;
      if (!lastEvent || !btn) return;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = lastEvent.clientX - cx;
      const dy = lastEvent.clientY - cy;
      btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      btn.classList.add("magnetic-active");
    };

    const handleMove = (e) => {
      lastEvent = e;
      if (!rafId) rafId = requestAnimationFrame(update);
    };

    const handleLeave = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (btn) {
        btn.style.transform = "translate(0px, 0px)";
        btn.classList.remove("magnetic-active");
      }
    };

    zone.addEventListener("mousemove", handleMove);
    zone.addEventListener("mouseleave", handleLeave);
    return () => {
      zone.removeEventListener("mousemove", handleMove);
      zone.removeEventListener("mouseleave", handleLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [strength]);

  return (
    <span ref={zoneRef} className="magnetic-zone" style={{ display: block ? "block" : "inline-block", padding: radius, margin: -radius, lineHeight: 0 }}>
      <button
        ref={buttonRef}
        className={`magnetic-btn${className ? ` ${className}` : ""}`}
        style={{ ...style, transition: `${style?.transition || ""}${style?.transition ? ", " : ""}transform 0.4s cubic-bezier(.2,.7,.2,1)`.replace(/^, /, "") }}
        {...props}
      >
        {children}
      </button>
    </span>
  );
}

// Particles + Floating Emojis Background
function ParticlesBackground() {
  const canvasRef = useRef(null);

  // Phone = touch device with a NARROW screen. Tablets (touch but width
  // >= 768) and desktop (hover/fine pointer) keep the full effect with
  // sprite-cached orbs + 30fps cap. Phones alone bailed because the
  // optimised loop still triggered the reload loop there.
  // Kept in state + a resize listener so rotating a phone (or resizing across
  // the 768 threshold) re-evaluates the gate instead of being frozen at mount.
  const computeIsPhone = () => typeof window !== "undefined" &&
    (window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches) &&
    window.innerWidth < 768;
  const [isPhone, setIsPhone] = useState(computeIsPhone);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsPhone(computeIsPhone());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (isPhone) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    // Mobile detection matches CursorGlow / useParallax / MagneticButton.
    // On mobile the full effect runs but at a ~30fps cap (FRAME_MIN_MS)
    // and with fewer dot particles; orbs are drawn from pre-rendered
    // sprites so the GPU never re-rasterises radial gradients per frame.
    // That combination is what restores the original look without
    // re-triggering the mobile reload loop.
    const isMobile = window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 30 : 75;
    const FRAME_MIN_MS = isMobile ? 33 : 0; // ~30fps cap on mobile, uncapped on desktop

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Dot particles — tiered size/alpha mix (original look).
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: i < 8 ? Math.random() * 3 + 2 : i < 25 ? Math.random() * 1.5 + 0.8 : Math.random() * 0.8 + 0.2,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      // Subtle visibility bump: faint specks (was *0.2+0.05 → 0.05–0.25) and
      // the larger dots (was *0.35+0.15) nudged up ~0.05 so they read as
      // gently present, still soft. Count/size/motion unchanged — opacity only.
      alpha: i < 8 ? Math.random() * 0.38 + 0.2 : Math.random() * 0.22 + 0.1,
      color: i < 12 ? '#FF6B35' : i < 22 ? '#ff8c5a' : '#ffffff',
      pulse: Math.random() * Math.PI * 2,
    }));

    // Ambient glowing orbs — large, soft, drifting (premium feel).
    const orbs = [
      { baseX: 0.2, baseY: 0.3, baseR: 320, color: '255, 107, 53', alpha: 0.10, speed: 0.00018, phase: 0 },
      { baseX: 0.8, baseY: 0.7, baseR: 280, color: '255, 140, 90', alpha: 0.08, speed: 0.00022, phase: Math.PI / 2 },
      { baseX: 0.5, baseY: 0.15, baseR: 240, color: '255, 107, 53', alpha: 0.06, speed: 0.00028, phase: Math.PI },
      { baseX: 0.1, baseY: 0.9, baseR: 360, color: '230, 80, 35', alpha: 0.07, speed: 0.00016, phase: Math.PI * 1.5 },
      { baseX: 0.7, baseY: 0.5, baseR: 200, color: '255, 200, 150', alpha: 0.045, speed: 0.00032, phase: Math.PI / 3 },
    ];

    // OPTIMISATION A — pre-render each orb's radial gradient ONCE into an
    // offscreen 256x256 canvas. The gradient depends only on color + alpha
    // (both constant per orb), so it can be cached for the lifetime of
    // the effect. The draw loop then uses ctx.drawImage to blit the
    // sprite scaled to the orb's current radius — orders of magnitude
    // cheaper than ctx.createRadialGradient + arc fill every frame.
    const SPRITE_SIZE = 256;
    orbs.forEach((o) => {
      const off = document.createElement('canvas');
      off.width = SPRITE_SIZE;
      off.height = SPRITE_SIZE;
      const octx = off.getContext('2d');
      const sc = SPRITE_SIZE / 2;
      const g = octx.createRadialGradient(sc, sc, 0, sc, sc, sc);
      g.addColorStop(0, `rgba(${o.color}, ${o.alpha})`);
      g.addColorStop(0.45, `rgba(${o.color}, ${o.alpha * 0.35})`);
      g.addColorStop(1, `rgba(${o.color}, 0)`);
      octx.fillStyle = g;
      octx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      o.sprite = off;
    });

    // OPTIMISATION B — frame-rate cap on mobile. rAF still fires at the
    // display rate, but the heavy clear+composite+draw block only runs
    // when at least FRAME_MIN_MS has elapsed since the last paint. The
    // animation timing inside draw() is t-based (Date.now()) so motion
    // stays in sync regardless of how many frames are skipped.
    let lastFrameMs = 0;

    const draw = (now) => {
      animId = requestAnimationFrame(draw);
      if (FRAME_MIN_MS > 0 && now - lastFrameMs < FRAME_MIN_MS) return;
      lastFrameMs = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t2 = Date.now() / 1000;
      const tMs = Date.now();

      // Ambient orbs — soft glowing background atmosphere via cached
      // sprites with 'lighter' compositing for the original bloom feel.
      ctx.globalCompositeOperation = 'lighter';
      orbs.forEach(o => {
        const driftX = Math.sin(tMs * o.speed + o.phase) * 70;
        const driftY = Math.cos(tMs * o.speed * 0.7 + o.phase) * 50;
        const cx = canvas.width * o.baseX + driftX;
        const cy = canvas.height * o.baseY + driftY;
        const radius = o.baseR + Math.sin(t2 * 0.4 + o.phase) * 25;
        ctx.drawImage(o.sprite, cx - radius, cy - radius, radius * 2, radius * 2);
      });
      ctx.globalCompositeOperation = 'source-over';

      // Dot particles
      particles.forEach(p => {
        const pr = p.r + Math.sin(t2 * 1.5 + p.pulse) * 0.3;
        const pa = p.alpha + Math.sin(t2 * 1.2 + p.pulse) * 0.06;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, pr), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, pa);
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });

      // Connections between nearby particles — desktop only (O(n²) over
      // 75 particles; skipped on mobile to keep the 30fps cap honest).
      if (!isMobile) {
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 100 * 100) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = '#FF6B35';
              ctx.globalAlpha = (1 - distSq / 10000) * 0.06;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      ctx.globalAlpha = 1;
    };

    const start = () => { if (animId == null) animId = requestAnimationFrame(draw); };
    const stop = () => { if (animId != null) { cancelAnimationFrame(animId); animId = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    };
  }, [isPhone]);

  if (isPhone) return null;

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, opacity: 0.85,
    }} />
  );
}


// Cursor Glow Effect
function CursorGlow() {
  const elRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = elRef.current;
    if (!el) return;

    let pendingX = -200;
    let pendingY = -200;
    let rafId = null;

    const flush = () => {
      rafId = null;
      el.style.transform = `translate3d(${pendingX - 200}px, ${pendingY - 200}px, 0)`;
    };

    const move = (e) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      el.style.opacity = '1';
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };
    const leave = () => { el.style.opacity = '0'; };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseleave', leave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={elRef} style={{
      position: 'fixed', pointerEvents: 'none', zIndex: 9999,
      left: 0, top: 0,
      width: 400, height: 400,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
      transition: 'opacity 0.3s',
      opacity: 0,
      transform: 'translate3d(-400px, -400px, 0)',
      willChange: 'transform, opacity',
    }} />
  );
}

// Scroll Reveal Hook
function useScrollReveal(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return visible;
}

// ============ PARALLAX HOOK — scroll-driven depth (desktop only) ============
function useParallax(factor = 0.2) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Disabled on touch devices and when reduced-motion is requested
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;
    let rafId = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setOffset(window.scrollY * factor);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [factor]);
  return offset;
}

// Subtle reassurance row — shipping, delivery, secure payment, returns.
// Self-contained so it can drop into any page without parent prop wiring.
function TrustRow({ lang }) {
  const t = LANGS[lang];
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const iconProps = {
    width: 16, height: 16, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  };

  const items = [
    { key: "shipping", label: t.trust.shipping, icon: (
      <svg {...iconProps}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
    ) },
    { key: "delivery", label: t.trust.delivery, icon: (
      <svg {...iconProps}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    ) },
    { key: "secure", label: t.trust.secure, icon: (
      <svg {...iconProps}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
    ) },
    { key: "returns", label: t.trust.returns, icon: (
      <svg {...iconProps}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
    ) },
  ];

  return (
    <div role="list" dir={t.dir} style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center",
      columnGap: isMobile ? 16 : 28, rowGap: 8,
      padding: isMobile ? "10px 14px" : "12px 22px",
      borderRadius: 999,
      border: `1px solid rgba(255,107,53,0.18)`,
      background: "rgba(255,107,53,0.04)",
      maxWidth: 720,
      margin: "0 auto",
      fontFamily: "'Varela Round',sans-serif",
      fontSize: isMobile ? 12 : 13,
      color: COLORS.gray,
      boxSizing: "border-box",
    }}>
      {items.map((it) => (
        <span key={it.key} role="listitem" style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-flex", color: COLORS.accent, flexShrink: 0 }}>{it.icon}</span>
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

// ============ EVENT / GROUP ORDERS — WhatsApp-led inquiry section ============
// Home-page section promoting custom shirts for events. NOT a checkout — the CTA
// opens WhatsApp (same WHATSAPP_NUMBER as the floating button) with a prefilled
// message so the customer becomes a lead and the shop replies with a quote. No
// pricing/cart/order changes. On-brand (dark + burnt-orange), feather-style line
// icons matching TrustRow, trilingual + RTL.
function EventOrdersSection({ lang }) {
  const isRTL = lang === `he`;
  const dir = isRTL ? `rtl` : `ltr`;
  const eyebrow = lang === `he` ? `הזמנות קבוצתיות` : lang === `ru` ? `Групповые заказы` : `Group orders`;
  const heading = lang === `he` ? `חולצות מותאמות לאירועים` : lang === `ru` ? `Футболки на заказ для мероприятий` : `Custom shirts for events`;
  const copy = lang === `he`
    ? `מסיבות רווקים/רווקות, חתונות, ימי הולדת ואירועי צוות/חברה — עיצובים אישיים, שמות ומחיר מיוחד לכמות (5 חולצות ומעלה), עם מבחר צבעים רחב יותר להזמנות קבוצתיות. ייצור מקומי בבאר שבע עם זמן אספקה מהיר לתאריך האירוע שלכם.`
    : lang === `ru`
    ? `Девичники/мальчишники, свадьбы, дни рождения и корпоративы — персональный дизайн, имена и специальные цены на количество (от 5 футболок), с расширенным выбором цветов для групповых заказов. Местное производство в Беэр-Шеве с быстрым сроком к дате вашего мероприятия.`
    : `Bachelor/ette parties, weddings, birthdays, and team/company events — personalized designs, names, and special pricing for quantity (5+ shirts), with a wider color range for group orders. Local production in Be'er Sheva with fast turnaround for your event date.`;
  const ctaLabel = lang === `he` ? `דברו איתנו בוואטסאפ` : lang === `ru` ? `Напишите нам в WhatsApp` : `Chat with us on WhatsApp`;
  const prefill = lang === `he`
    ? `היי! אני מעוניין/ת בהזמנה קבוצתית לחולצות לאירוע`
    : lang === `ru`
    ? `Здравствуйте! Меня интересует групповой заказ футболок для мероприятия`
    : `Hi! I'm interested in a group order of shirts for an event`;
  const waValid = /^\d{6,15}$/.test(WHATSAPP_NUMBER || ``);
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefill)}`;

  // Feather-style line icons — same shape as TrustRow (24-grid, stroke, no fill).
  const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const chips = [
    { key: `bachelor`, label: lang === `he` ? `מסיבת רווקות/רווקים` : lang === `ru` ? `Девичник·мальчишник` : `Bachelor/ette party`,
      icon: <svg {...iconProps}><path d="M6 3h12l-6 8z" /><line x1="12" y1="11" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /></svg> },
    { key: `wedding`, label: lang === `he` ? `חתונה` : lang === `ru` ? `Свадьба` : `Wedding`,
      icon: <svg {...iconProps}><circle cx="9" cy="14" r="6" /><circle cx="15" cy="14" r="6" /><path d="M9 4l3 3 3-3" /></svg> },
    { key: `birthday`, label: lang === `he` ? `יום הולדת` : lang === `ru` ? `День рождения` : `Birthday`,
      icon: <svg {...iconProps}><path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" /><path d="M4 16h16" /><line x1="8" y1="9" x2="8" y2="6" /><line x1="12" y1="9" x2="12" y2="6" /><line x1="16" y1="9" x2="16" y2="6" /></svg> },
    { key: `team`, label: lang === `he` ? `גיבוש צוות` : lang === `ru` ? `Корпоратив` : `Team event`,
      icon: <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  ];

  return (
    <section aria-labelledby="event-orders-title" dir={dir} style={{ background: COLORS.bg, padding: `8px 24px 72px` }}>
      <div style={{ maxWidth: 860, margin: `0 auto`, background: `linear-gradient(180deg, rgba(255,107,53,0.08) 0%, rgba(255,107,53,0.03) 100%)`, border: `1px solid rgba(255,107,53,0.25)`, borderRadius: 20, padding: isRTL ? `40px 28px` : `40px 28px`, textAlign: `center` }}>
        <span style={{ display: `inline-block`, background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 100, padding: `6px 18px`, marginBottom: 18, color: COLORS.accent, fontSize: 12, fontWeight: 600, letterSpacing: `0.1em`, textTransform: `uppercase`, fontFamily: `'Varela Round',sans-serif` }}>{eyebrow}</span>
        <h2 id="event-orders-title" style={{ fontFamily: `'Playfair Display',serif`, fontWeight: 900, fontSize: `clamp(28px,5vw,42px)`, lineHeight: 1.1, color: COLORS.white, margin: `0 0 16px` }}>{heading}</h2>
        <p style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 15.5, lineHeight: 1.7, maxWidth: 640, margin: `0 auto 26px` }}>{copy}</p>

        <ul role="list" style={{ listStyle: `none`, margin: `0 0 30px`, padding: 0, display: `flex`, flexWrap: `wrap`, justifyContent: `center`, gap: 10 }}>
          {chips.map((c) => (
            <li key={c.key} style={{ display: `inline-flex`, alignItems: `center`, gap: 8, padding: `9px 15px`, borderRadius: 999, border: `1px solid rgba(255,107,53,0.25)`, background: `rgba(255,107,53,0.06)`, color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 13.5, fontWeight: 500, whiteSpace: `nowrap` }}>
              <span style={{ display: `inline-flex`, color: COLORS.accent, flexShrink: 0 }}>{c.icon}</span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>

        {waValid && (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ctaLabel}
            style={{ display: `inline-flex`, alignItems: `center`, gap: 10, background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 10, padding: `15px 30px`, fontSize: 16, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, textDecoration: `none`, transition: `background 0.2s, box-shadow 0.3s`, boxShadow: `0 6px 22px rgba(255,107,53,0.28)` }}
            onMouseOver={(e) => { e.currentTarget.style.background = COLORS.accentBtnHover; }}
            onMouseOut={(e) => { e.currentTarget.style.background = COLORS.accentBtn; }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.582 0 11.94-5.335 11.944-11.893a11.821 11.821 0 0 0-3.487-8.46z" /></svg>
            <span>{ctaLabel}</span>
          </a>
        )}
      </div>
    </section>
  );
}

// Star rating row — small Playfair-styled stars. role="img" gives screen readers the rating.
function ReviewStars({ rating, label }) {
  const full = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <div role="img" aria-label={`${full}/5 — ${label}`} style={{ display: "inline-flex", gap: 2, color: COLORS.accent, fontSize: 14, lineHeight: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden="true" style={{ opacity: i < full ? 1 : 0.25 }}>★</span>
      ))}
    </div>
  );
}

// Customer reviews section — only renders when at least one active row exists in
// the `testimonials` table on Supabase (schema in /testimonials.sql at repo root).
// Empty/no-rows → returns null so we never show placeholder/fake content.
function Reviews({ lang }) {
  const isRTL = lang === "he";
  const t = LANGS[lang]?.reviews || LANGS.he.reviews;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("testimonials")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (error) throw error;
        setReviews(data || []);
      } catch (err) {
        // Table may not exist yet (Gleb hasn't run testimonials.sql). Silently hide.
        setReviews([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Inject AggregateRating into the page-level JSON-LD when we have ratings,
  // and clean up if the component unmounts or reviews change.
  useEffect(() => {
    if (typeof document === "undefined" || !reviews.length) return;
    const ratings = reviews.map(r => Number(r.rating)).filter(n => Number.isFinite(n) && n > 0);
    if (!ratings.length) return;
    const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    const payload = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": "https://www.sfalimshop.com/#organization",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": String(avg),
        "reviewCount": String(reviews.length),
        "bestRating": "5",
        "worstRating": "1",
      },
    };
    const id = "sfalim-aggregate-rating";
    const stale = document.getElementById(id);
    if (stale) stale.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.text = JSON.stringify(payload);
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [reviews]);

  // Hide entirely until Gleb has at least one active review — no placeholders.
  if (loading || !reviews.length) return null;

  const body = (r) => r[`body_${lang}`] || r.body_he || r.body_en || "";

  return (
    <section dir={isRTL ? "rtl" : "ltr"} style={{ padding: isMobile ? "60px 20px" : "80px 24px", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 5 }}>
      <div className="reveal" style={{ textAlign: "center", marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "2px", marginBottom: 12, textTransform: "uppercase" }}>
          {t.eyebrow}
        </div>
        <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "2rem" : "2.6rem", margin: 0, letterSpacing: "-0.01em" }}>
          {t.title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 18 }}>
          <div style={{ width: 40, height: 1, background: COLORS.accent }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
          <div style={{ width: 40, height: 1, background: COLORS.accent }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: isMobile ? 16 : 24 }}>
        {reviews.map((r, idx) => (
          <article key={r.id} className="reveal" data-delay={String(Math.min(idx + 1, 6))} aria-label={t.aria} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: isMobile ? "20px 18px" : "26px 24px", display: "flex", flexDirection: "column", gap: 12, transition: "border-color 0.25s, transform 0.18s cubic-bezier(.2,.6,.2,1)" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-4px)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; }}
            onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onTouchEnd={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            onTouchCancel={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <ReviewStars rating={r.rating} label={t.aria} />
            <blockquote style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: isMobile ? 16 : 18, lineHeight: 1.55, margin: 0 }}>
              “{body(r)}”
            </blockquote>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
              {r.author_avatar && (
                <img src={r.author_avatar} alt={r.author_name} loading="lazy" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${COLORS.border}` }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span style={{ color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontWeight: 600, fontSize: 13 }}>{r.author_name}</span>
                {(r.author_city || r.product) && (
                  <span style={{ color: COLORS.gray, fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>
                    {[r.author_city, r.product].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// Corner badges for regular product cards (Bestseller / New). Mirrors PetBadges
// styling so badges look identical across the BLOOM gallery and the homepage grid.
function ProductBadges({ product, lang }) {
  const isRTL = lang === "he";
  const labels = LANGS[lang].badges;
  const showBest = !!product?.is_bestseller;
  const showNew = !!product?.is_new;
  if (!showBest && !showNew) return null;
  return (
    <div style={{ position: "absolute", top: 10, insetInlineStart: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 3, pointerEvents: "none" }}>
      {showBest && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: COLORS.accentBtn, color: "#fff", fontFamily: "'Varela Round',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, boxShadow: "0 4px 12px rgba(255,107,53,0.35)", whiteSpace: "nowrap" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {labels.bestseller}
        </span>
      )}
      {showNew && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(15,15,15,0.85)", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, fontFamily: "'Varela Round',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 6, backdropFilter: "blur(4px)", whiteSpace: "nowrap" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 3l1.91 5.18L19 10l-5.09 1.82L12 17l-1.91-5.18L5 10l5.09-1.82L12 3z" />
          </svg>
          {labels.new}
        </span>
      )}
    </div>
  );
}

function Hero({ setPage, lang }) {
  const t = LANGS[lang];
  const products = getCustomProducts(t);
  // Parallax offsets are CAPPED so they don't keep growing with scroll. Without
  // a cap, the cards' translateY grew unbounded (scrollY * 0.32) and visually
  // overflowed past the Hero's bottom, sliding behind the Footer (zIndex: 5) and
  // making the bottom row of cards look hidden. A small cap keeps the parallax
  // feel without letting the cards leave their section.
  const pText = Math.min(useParallax(0.15), 60);
  const pCards = Math.min(useParallax(0.32), 50);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const handle = () => setVw(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  const isMobile = vw < 768;
  const gridCols = vw >= 900 ? "repeat(4, 1fr)" : vw >= 600 ? "repeat(2, 1fr)" : "1fr";
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 120px", direction: t.dir, background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 60%), ${COLORS.bg}` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", transform: `translateY(${pText}px)`, willChange: "transform" }}>
      <div className="reveal" style={{ display: "inline-block", background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 100, padding: "6px 18px", marginBottom: 24, color: COLORS.accent, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Varela Round',sans-serif" }}>{t.hero.badge}</div>
      <h1 className="reveal" data-delay="1" style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(36px,8vw,90px)", fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: "-2px", color: COLORS.white }}>
        {t.hero.h1line1}<br /><span style={{ color: COLORS.accent, fontStyle: "italic" }}>{t.hero.h1line2}</span>
      </h1>
      <p className="reveal" data-delay="2" style={{ color: COLORS.gray, fontSize: 18, maxWidth: 480, lineHeight: 1.7, marginBottom: 40, fontFamily: "'Varela Round',sans-serif", fontWeight: 300 }}>{t.hero.sub}</p>
      <span className="reveal" data-delay="3" style={{ display: "inline-flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <MagneticButton onClick={() => setPage("order")} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", padding: "16px 36px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "background 0.2s, box-shadow 0.3s" }} onMouseOver={e => e.target.style.background = COLORS.accentBtnHover} onMouseOut={e => e.target.style.background = COLORS.accentBtn}>{t.hero.cta}</MagneticButton>
        <button onClick={() => setPage("pets")} style={{ background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, padding: "16px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Playfair Display',serif", fontStyle: "italic", letterSpacing: "0.3px", transition: "background 0.2s, color 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}
        >{t.hero.ctaSecondary} →</button>
        <a href="/quiz" style={{ display: "inline-flex", alignItems: "center", background: COLORS.accentDim, color: COLORS.accent, border: `1px solid rgba(255,107,53,0.4)`, padding: "16px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", textDecoration: "none", fontFamily: "'Varela Round',sans-serif", transition: "background 0.2s, color 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtnDim; e.currentTarget.style.color = COLORS.accent; }}
        >{t.quiz.hero_cta}</a>
      </span>
      <div className="reveal" data-delay="4" style={{ marginTop: isMobile ? 48 : 64, width: "100%", maxWidth: 720, padding: "0 8px", boxSizing: "border-box" }}>
        <TrustRow lang={lang} />
      </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 20, marginTop: isMobile ? 32 : 48, width: "100%", maxWidth: vw >= 900 ? 900 : vw >= 600 ? 560 : 420, transform: `translateY(${pCards}px)`, willChange: "transform" }}>
        {products.map((p, idx) => (
          <div key={p.id} onClick={() => setPage("order")} className="reveal" data-delay={String(Math.min(idx + 1, 6))}
            style={{ position: "relative", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: isMobile ? "24px 24px" : "28px 32px", cursor: "pointer", transition: "border-color 0.2s, transform 0.18s cubic-bezier(.2,.6,.2,1), box-shadow 0.3s, opacity 0.75s cubic-bezier(.2,.6,.2,1)" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-8px)"; e.currentTarget.style.boxShadow = `0 20px 40px rgba(255,107,53,0.15)`; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onTouchEnd={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            onTouchCancel={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <ProductBadges product={p} lang={lang} />
            <div style={{ width: "100%", height: 130, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SmartImage src={transformImage(MOCKUP_URLS[p.id], { width: 320 })} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 22, marginBottom: 4, letterSpacing: "-0.3px" }}>{p.name}</div>
            <div style={{ width: 24, height: 2, background: "rgba(255,107,53,0.4)", margin: "8px 0", borderRadius: 2 }}></div>
            <div style={{ color: COLORS.gray, fontFamily: "'Varela Round',sans-serif", fontSize: 12, lineHeight: 1.5, marginTop: 4, minHeight: 34 }}>{p.desc?.[lang] || p.desc?.en || ""}</div>
            <div style={{ color: COLORS.accent, fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 13, marginTop: 8 }}>{formatPriceRange(p.variants)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nav
function Nav({ page, setPage, goToBlog, lang, setLang, user, isAdmin, onLogout, cartCount, onCartClick, preview = false }) {
  const t = LANGS[lang];
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  // Trigger a one-shot scale bump on the badge whenever cartCount goes up,
  // so the user gets visual confirmation that an item was just added.
  const [bumpKey, setBumpKey] = useState(0);
  const prevCountRef = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCountRef.current) setBumpKey(k => k + 1);
    prevCountRef.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Favorites count for the nav badge — client-only store, live across components.
  const { favorites } = useFavorites();
  const favCount = favorites.length;

  // Cart icon with item-count badge — reused in the desktop and mobile nav.
  const cartButton = (
    <button onClick={onCartClick} aria-label={lang === "he" ? "סל קניות" : lang === "ru" ? "Корзина" : "Cart"}
      style={{ position: "relative", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}
      onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {cartCount > 0 && (
        <span key={bumpKey} className="cart-badge-bump" role="status" aria-live="polite" aria-label={`${cartCount} ${lang === "he" ? "פריטים בסל" : lang === "ru" ? "товаров в корзине" : "items in cart"}`} style={{ position: "absolute", top: -7, insetInlineEnd: -7, minWidth: 19, height: 19, padding: "0 5px", boxSizing: "border-box", borderRadius: 10, background: COLORS.accentBtn, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.bg}` }}>{cartCount}</span>
      )}
    </button>
  );

  // Favorites heart with a live count badge — navigates to the gallery's
  // favorites view (#/pets?fav=1). Mirrors the cart button's styling; the icon
  // stays an outline (the badge conveys the count).
  const favButton = (
    <button onClick={() => { try { window.location.hash = `/pets?fav=1`; } catch (_) {} }}
      aria-label={lang === "he" ? "המועדפים שלי" : lang === "ru" ? "Избранное" : "Favorites"}
      style={{ position: "relative", background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }}
      onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      {favCount > 0 && (
        <span role="status" aria-live="polite" aria-label={`${favCount} ${lang === "he" ? "מועדפים" : lang === "ru" ? "в избранном" : "favorites"}`} style={{ position: "absolute", top: -7, insetInlineEnd: -7, minWidth: 19, height: 19, padding: "0 5px", boxSizing: "border-box", borderRadius: 10, background: COLORS.accentBtn, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.bg}` }}>{favCount}</span>
      )}
    </button>
  );

  // Instagram icon link — square button, matches the cart button's style.
  const instagramButton = (
    <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" aria-label={t.bloom.instagramAria}
      style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0, transition: "all 0.2s" }}
      onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    </a>
  );

  // Pre-launch public preview: a slim nav with only what works for a visitor
  // who can't buy yet — logo (→ coming-soon landing), an "Explore BLOOM" link
  // (→ pets), and the language switcher. No cart/login/order/track links that
  // would just bounce to the maintenance screen. Staff/admin/post-launch fall
  // through to the full nav below, 100% unchanged.
  if (preview) {
    return (
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.95)", backdropFilter: "blur(24px)", borderBottom: `1px solid rgba(255,107,53,0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", height: 72, direction: "ltr", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
        {/* Logo → coming-soon landing */}
        <button type="button" onClick={() => setPage("home")} aria-label={lang === "he" ? "ספלים שופ — דף הבית" : lang === "ru" ? "Sfalim Shop — главная" : "Sfalim Shop — home"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
          <img src="/logo.jpg" alt="" style={{ height: isMobile ? 40 : 58, width: "auto", maxWidth: isMobile ? 160 : 280, mixBlendMode: "screen" }} />
        </button>
        {/* Explore BLOOM + language switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flexShrink: 0 }}>
          <button onClick={() => setPage("pets")} style={{ background: page === "pets" ? COLORS.accentDim : "transparent", border: `1px solid ${page === "pets" ? COLORS.accent : COLORS.border}`, color: page === "pets" ? COLORS.accent : COLORS.white, padding: isMobile ? "8px 14px" : "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? 13 : 14, letterSpacing: "0.5px", whiteSpace: "nowrap", transition: "all 0.2s" }}
            onMouseOver={e => { if (page !== "pets") { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; } }}
            onMouseOut={e => { if (page !== "pets") { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; } }}
          >{t.nav.pets}</button>
          <div role="group" aria-label={lang === "he" ? "שפה" : lang === "ru" ? "Язык" : "Language"} style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
            {Object.keys(LANGS).map(l => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accentBtn : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: isMobile ? "8px 12px" : "9px 14px", minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: isMobile ? 11 : 12, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.95)", backdropFilter: "blur(24px)", borderBottom: `1px solid rgba(255,107,53,0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", height: 72, direction: "ltr", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
      {/* Logo - LEFT */}
      <button type="button" onClick={() => setPage("home")} aria-label={lang === "he" ? "ספלים שופ — דף הבית" : lang === "ru" ? "Sfalim Shop — главная" : "Sfalim Shop — home"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
        <img src="/logo.jpg" alt="" style={{ height: isMobile ? 40 : 58, width: "auto", maxWidth: isMobile ? 160 : 280, mixBlendMode: "screen" }} /></button>

      {/* Nav links - CENTER (desktop only) */}
      {!isMobile && <div style={{ display: "flex", gap: 4, alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        {["home", "order", "pets", "about"].map(p => (
          <button key={p} onClick={() => setPage(p)} aria-current={page === p ? "page" : undefined} style={{
            background: page === p ? COLORS.accentDim : "transparent",
            border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent",
            color: page === p ? COLORS.accent : COLORS.gray,
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
            fontFamily: p === "pets" ? "'Playfair Display',serif" : "'Varela Round',sans-serif",
            fontSize: 13, fontWeight: p === "pets" ? 700 : 500,
            fontStyle: p === "pets" ? "italic" : "normal",
            letterSpacing: p === "pets" ? "0.5px" : "normal",
            transition: "all 0.2s", position: "relative", overflow: "hidden",
          }}
          onMouseOver={e => { if(page !== p) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== p) { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
          >{t.nav[p]}</button>
        ))}
        <button onClick={() => goToBlog && goToBlog()} aria-current={page === "blog" ? "page" : undefined} style={{ background: page === "blog" ? COLORS.accentDim : "transparent", border: page === "blog" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "blog" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
          onMouseOver={e => { if(page !== "blog") { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== "blog") { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
        >{t.navBlog}</button>
        <a href="/quiz" style={{ background: "transparent", border: "1px solid transparent", color: COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseOut={e => { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}
        >{t.quiz.nav}</a>
        {user && (
          <button onClick={() => setPage("track")} aria-current={page === "track" ? "page" : undefined} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
          onMouseOver={e => { if(page !== "track") { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== "track") { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
          >{t.nav.track}</button>
        )}
        {isAdmin && (
          <button onClick={() => setPage("admin")} aria-current={page === "admin" ? "page" : undefined} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}>{t.nav.admin}</button>
        )}
      </div>}

      {/* Lang + Hamburger - MOBILE RIGHT */}
      {isMobile && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {favButton}
        {cartButton}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accentBtn : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: "8px 11px", minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
          ))}
        </div>
        <button onClick={() => setMobileMenu(m => !m)} aria-expanded={mobileMenu} aria-controls="mobile-nav-menu" aria-label={lang === "he" ? "תפריט" : lang === "ru" ? "Меню" : "Menu"} style={{ background: mobileMenu ? COLORS.accentDim : "transparent", border: `1px solid ${mobileMenu ? COLORS.accent : COLORS.border}`, color: COLORS.white, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 22, lineHeight: 1, transition: "all 0.2s" }}>{mobileMenu ? "✕" : "☰"}</button>
      </div>}

      {/* Auth + Lang - RIGHT (desktop only) */}
      {!isMobile && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {favButton}
        {cartButton}
        {instagramButton}
        {user ? (
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.gray; }}
          >{t.nav.logout}</button>
        ) : (
          <button onClick={() => setPage("auth")} style={{ background: COLORS.accentBtn, border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: "0 0 20px rgba(255,107,53,0.3)" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtnHover; e.currentTarget.style.boxShadow = "0 0 30px rgba(255,107,53,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.boxShadow = "0 0 20px rgba(255,107,53,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >{t.nav.login}</button>
        )}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accentBtn : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: "9px 13px", minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
          ))}
        </div>
      </div>}
    </nav>

    {/* Mobile dropdown */}
    {mobileMenu && (
      <div id="mobile-nav-menu" role="navigation" aria-label={lang === "he" ? "תפריט ראשי" : lang === "ru" ? "Главное меню" : "Main menu"} style={{ position: "fixed", top: 72, left: 0, right: 0, zIndex: 99, background: "rgba(15,15,15,0.98)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`, padding: 20, display: "flex", flexDirection: "column", gap: 8, direction: lang === "he" ? "rtl" : "ltr" }}>
        {["home", "order", "pets", "about"].map(p => (
          <button key={p} onClick={() => { setPage(p); setMobileMenu(false); }} aria-current={page === p ? "page" : undefined} style={{ background: page === p ? COLORS.accentDim : "transparent", border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === p ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: p === "pets" ? "'Playfair Display',serif" : "'Varela Round',sans-serif", fontSize: 16, fontWeight: p === "pets" ? 700 : 500, fontStyle: p === "pets" ? "italic" : "normal", textAlign: "start", width: "100%" }}>{t.nav[p]}</button>
        ))}
        <button onClick={() => { if (goToBlog) goToBlog(); setMobileMenu(false); }} aria-current={page === "blog" ? "page" : undefined} style={{ background: page === "blog" ? COLORS.accentDim : "transparent", border: page === "blog" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "blog" ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 500, textAlign: "start", width: "100%" }}>{t.navBlog}</button>
        {user && <button onClick={() => { setPage("track"); setMobileMenu(false); }} aria-current={page === "track" ? "page" : undefined} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, textAlign: "start", width: "100%" }}>{t.nav.track}</button>}
        {isAdmin && <button onClick={() => { setPage("admin"); setMobileMenu(false); }} aria-current={page === "admin" ? "page" : undefined} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, textAlign: "start", width: "100%" }}>{t.nav.admin}</button>}
        <div style={{ height: 1, background: COLORS.border, margin: "8px 0" }} />
        {user
          ? <button onClick={() => { onLogout(); setMobileMenu(false); }} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, width: "100%" }}>{t.nav.logout}</button>
          : <button onClick={() => { setPage("auth"); setMobileMenu(false); }} style={{ background: COLORS.accentBtn, border: "none", color: "#fff", padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, width: "100%" }}>{t.nav.login}</button>
        }
        <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer" aria-label={t.bloom.instagramAria}
          onClick={() => setMobileMenu(false)}
          style={{ background: "transparent", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, width: "100%", boxSizing: "border-box", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          <span>{t.bloom.instagramAria}</span>
        </a>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); setMobileMenu(false); }} style={{ background: lang === l ? COLORS.accentBtn : COLORS.bgCard, color: lang === l ? "#fff" : COLORS.gray, border: `1px solid ${lang === l ? COLORS.accent : COLORS.border}`, borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Varela Round',sans-serif" }}>{LANGS[l].label}</button>
          ))}
        </div>
      </div>
    )}
    </>
  );
}

// Main App

// ============ ACCESSIBILITY ============
function AccessibilityMenu({ lang, cartOpen, reduceMotion, setReduceMotion }) {
  const [open, setOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    // High-contrast uses a CSS `filter`, and a `filter` makes the element it's
    // set on the containing block for ALL position:fixed descendants. Setting it
    // on <body> therefore re-anchored the fixed a11y button/panel to the (tall)
    // body box, dropping them to the page bottom. Apply it to #root instead —
    // and the a11y widget is portaled to <body> (a sibling of #root, unfiltered)
    // below — so the widget keeps its viewport-fixed position while the whole app
    // inside #root still gets the contrast boost.
    const target = (typeof document !== `undefined` && (document.getElementById(`root`) || document.documentElement)) || null;
    if (!target) return;
    target.style.filter = highContrast ? `contrast(1.4) brightness(1.1)` : `none`;
    return () => { if (target) target.style.filter = `none`; };
  }, [highContrast]);

  useEffect(() => {
    if (reduceMotion) {
      const style = document.getElementById('reduce-motion-style') || document.createElement('style');
      style.id = 'reduce-motion-style';
      style.textContent = '* { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);
    } else {
      const style = document.getElementById('reduce-motion-style');
      if (style) style.remove();
    }
  }, [reduceMotion]);

  // A11y: focus the panel when open; restore focus to the toggle on close.
  const a11yPanelRef = useDialogFocus(open);

  // Cart drawer slides in from inline-end (right in LTR, left in RTL). Anchor
  // the a11y button to inline-start so the two never share the same edge.
  // On mobile the cart is full-width, so just hide the button while it's open.
  // Early-return MUST sit after every hook call above — otherwise toggling
  // cartOpen on mobile changes how many hooks React sees per render and the
  // component crashes (Rules of Hooks).
  if (cartOpen && isMobile) return null;

  const t = {
    he: { title: 'נגישות', textSize: 'גודל טקסט', contrast: 'ניגודיות גבוהה', motion: 'הפחת אנימציות', reset: 'איפוס', close: 'סגור' },
    en: { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' },
    ru: { title: 'Доступность', textSize: 'Размер текста', contrast: 'Высокий контраст', motion: 'Без анимации', reset: 'Сбросить', close: 'Закрыть' },
  }[lang] || { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' };

  const btnBase = { width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, textAlign: 'start', transition: 'all 0.2s', marginBottom: 8 };

  const widget = (
    <>
      {/* Accessibility button — fixed at the bottom inline-start corner so it
          always sits on the opposite side from the cart drawer. */}
      <button
        aria-label={t.title}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, insetInlineStart: 24, zIndex: 9998,
          width: 52, height: 52, borderRadius: '50%',
          background: '#FF6B35', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(255,107,53,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.25s',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(255,107,53,0.7)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,107,53,0.5)'; }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4" r="2"/>
          <path d="M12 6v6"/>
          <path d="M8 9h8"/>
          <path d="M9 22l3-10 3 10"/>
        </svg>
      </button>

      {/* Accessibility panel — sits on the same inline-start side as the button. */}
      {open && (
        <div ref={a11yPanelRef} role="dialog" aria-label={t.title} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} style={{
          position: 'fixed', bottom: 88, insetInlineStart: 24, zIndex: 9997,
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 16, padding: 20, width: 260, maxWidth: "calc(100vw - 48px)",
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'fadeUp 0.2s ease',
        }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: "'Varela Round',sans-serif", letterSpacing: "0.05em" }}>
            {t.title}
          </div>

          {/* Text size */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.textSize}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button aria-label={lang === 'he' ? 'הקטן טקסט' : lang === 'ru' ? 'Уменьшить текст' : 'Decrease text size'} onClick={() => setFontSize(f => Math.max(80, f - 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>−</button>
              <div style={{ flex: 1, textAlign: 'center', color: '#FF6B35', fontWeight: 700, fontFamily: "'Varela Round',sans-serif" }}>{fontSize}%</div>
              <button aria-label={lang === 'he' ? 'הגדל טקסט' : lang === 'ru' ? 'Увеличить текст' : 'Increase text size'} onClick={() => setFontSize(f => Math.min(140, f + 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>+</button>
            </div>
          </div>

          {/* High contrast */}
          <button onClick={() => setHighContrast(!highContrast)} style={{ ...btnBase, background: highContrast ? 'rgba(255,107,53,0.15)' : '#111', border: `1px solid ${highContrast ? '#FF6B35' : '#2a2a2a'}`, color: highContrast ? '#FF6B35' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t.contrast} <span>{highContrast ? '✓' : '○'}</span>
          </button>

          {/* Reduce motion */}
          <button onClick={() => setReduceMotion(!reduceMotion)} style={{ ...btnBase, background: reduceMotion ? 'rgba(255,107,53,0.15)' : '#111', border: `1px solid ${reduceMotion ? '#FF6B35' : '#2a2a2a'}`, color: reduceMotion ? '#FF6B35' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t.motion} <span>{reduceMotion ? '✓' : '○'}</span>
          </button>

          {/* Reset */}
          <button onClick={() => { setFontSize(100); setHighContrast(false); setReduceMotion(false); }} style={{ ...btnBase, background: 'transparent', border: '1px solid #2a2a2a', color: '#8a8a8a', textAlign: 'center', marginBottom: 0 }}>
            {t.reset}
          </button>
        </div>
      )}
    </>
  );
  // Portal the widget OUT of #root so the high-contrast filter on #root can never
  // become its containing block — keeps the button + panel viewport-fixed.
  return typeof document !== `undefined` ? createPortal(widget, document.body) : widget;
}

// ============ ABOUT PAGE ============
function AboutPage({ lang, setPage }) {
  const isRTL = lang === "he";
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const handle = () => setVw(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  // The process-step connector line only makes sense when the 4 steps sit in a
  // single row — that is guaranteed only on wide viewports.
  const showConnector = vw >= 920;
  const t = {
    he: {
      badge: 'באר שבע, בירת הנגב',
      title: 'אנחנו Sfalim Shop',
      subtitle: 'מקצועיות ושירות אדיב — מ-2023',
      story: 'Sfalim Shop נולד מתוך אהבה לעיצוב ויצירה. מאז 2023 אנחנו מביאים לחיים כל עיצוב — על חולצות, ספלים ומדבקות — עם רמת גימור מקצועית שתרגישו בה.',
      techTitle: 'הטכנולוגיות שלנו',
      tech: [
        { name: 'Sublimation', desc: 'הדפסה לחולצות פוליאסטר וספלים עם צבעים עמוקים ועמידים', num: '01' },
        { name: 'DTF', desc: 'הדפסה ישירה על בד — מתאים לכל סוג בד בפירוט מדהים', num: '02' },
        { name: 'Vinyl', desc: 'חיתוך ויניל לעיצובים חדים וברורים עם עמידות גבוהה', num: '03' },
      ],
      processTitle: 'איך זה עובד?',
      process: [
        { step: '01', title: 'בחר מוצר', desc: 'חולצה, ספל או מדבקה' },
        { step: '02', title: 'העלה עיצוב', desc: 'תמונה, לוגו, או כל קובץ' },
        { step: '03', title: 'מקם ושלח', desc: 'צפה בתצוגה מקדימה ושלח הזמנה' },
        { step: '04', title: 'קבל אצלך', desc: 'נייצר ונשלח אליך' },
      ],
      contactTitle: 'יצירת קשר',
      location: 'באר שבע, ישראל',
      cta: 'התחל להזמין',
    },
    en: {
      badge: 'Beer Sheva, Capital of the Negev',
      title: "We're Sfalim Shop",
      subtitle: 'Professionalism & friendly service — since 2023',
      story: 'Sfalim Shop was born from a love of design and creativity. Since 2023, we bring every design to life — on t-shirts, mugs and stickers — with professional quality you can feel.',
      techTitle: 'Our Technologies',
      tech: [
        { name: 'Sublimation', desc: 'Printing on polyester shirts and mugs with deep, durable colors', num: '01' },
        { name: 'DTF', desc: 'Direct to film printing on any fabric type with stunning detail', num: '02' },
        { name: 'Vinyl', desc: 'Vinyl cutting for sharp, clear designs with high durability', num: '03' },
      ],
      processTitle: 'How it works',
      process: [
        { step: '01', title: 'Choose product', desc: 'T-shirt, mug or sticker' },
        { step: '02', title: 'Upload design', desc: 'Image, logo or any file' },
        { step: '03', title: 'Place & send', desc: 'Preview and submit order' },
        { step: '04', title: 'Receive it', desc: "We'll create and ship to you" },
      ],
      contactTitle: 'Contact Us',
      location: 'Beer Sheva, Israel',
      cta: 'Start Ordering',
    },
    ru: {
      badge: 'Беэр-Шева, столица Негева',
      title: 'Мы — Sfalim Shop',
      subtitle: 'Профессионализм и дружелюбный сервис — с 2023',
      story: 'Sfalim Shop родился из любви к дизайну и творчеству. С 2023 года мы воплощаем любой дизайн в жизнь — на футболках, кружках и стикерах — с профессиональным качеством.',
      techTitle: 'Наши технологии',
      tech: [
        { name: 'Sublimation', desc: 'Печать на полиэстер и кружках с яркими стойкими цветами', num: '01' },
        { name: 'DTF', desc: 'Прямая печать на любой ткани с потрясающей детализацией', num: '02' },
        { name: 'Vinyl', desc: 'Виниловая резка для четких дизайнов с высокой прочностью', num: '03' },
      ],
      processTitle: 'Как это работает',
      process: [
        { step: '01', title: 'Выбрать товар', desc: 'Футболка, кружка или стикер' },
        { step: '02', title: 'Загрузить дизайн', desc: 'Фото, логотип или любой файл' },
        { step: '03', title: 'Разместить и отправить', desc: 'Просмотр и оформление заказа' },
        { step: '04', title: 'Получить', desc: 'Создадим и доставим вам' },
      ],
      contactTitle: 'Связаться с нами',
      location: 'Беэр-Шева, Израиль',
      cta: 'Начать заказ',
    },
  }[lang] || {};

  const sectionStyle = { maxWidth: 900, margin: '0 auto', padding: '0 24px' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', paddingTop: 90, fontFamily: "'Varela Round',sans-serif" }}>

      {/* Hero section */}
      <div style={{ ...sectionStyle, textAlign: 'center', padding: '60px 24px 80px' }}>
        <div className="reveal" style={{ display: 'inline-block', background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 100, padding: '6px 18px', marginBottom: 24, color: '#FF6B35', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {t.badge}
        </div>
        <h1 className="reveal" data-delay="1" style={{ color: '#fff', fontSize: 'clamp(36px,6vw,72px)', fontWeight: 900, marginBottom: 16, fontFamily: "'Playfair Display',serif", letterSpacing: '-1px' }}>{t.title}</h1>
        <p className="reveal" data-delay="2" style={{ color: '#FF6B35', fontSize: 18, marginBottom: 32 }}>{t.subtitle}</p>
        <p className="reveal" data-delay="3" style={{ color: '#888', fontSize: 17, maxWidth: 580, margin: '0 auto', lineHeight: 1.8 }}>{t.story}</p>
      </div>

      {/* Technologies */}
      <div style={{ background: '#111', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e', padding: '60px 24px' }}>
        <div style={{ ...sectionStyle }}>
          <h2 className="reveal" style={{ color: '#fff', fontSize: 32, marginBottom: 40, textAlign: 'center', fontFamily: "'Playfair Display',serif" }}>{t.techTitle}</h2>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {t.tech?.map((tech, i) => (
              <div key={i} className="reveal" data-delay={String(i + 1)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: '32px 32px 28px', flex: '1 1 220px', maxWidth: 280, transition: 'border-color 0.3s, transform 0.3s, opacity 0.75s cubic-bezier(.2,.6,.2,1)', position: 'relative' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#FF6B35'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 38, color: '#FF6B35', opacity: 0.85, lineHeight: 1, marginBottom: 14, letterSpacing: '-0.5px' }}>{tech.num}</div>
                <div style={{ width: 32, height: 2, background: 'rgba(255,107,53,0.4)', marginBottom: 14, borderRadius: 2 }}></div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, marginBottom: 10, fontFamily: "'Varela Round',sans-serif", letterSpacing: '0.3px' }}>{tech.name}</div>
                <div style={{ color: '#777', fontSize: 13.5, lineHeight: 1.7 }}>{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process */}
      <div style={{ padding: '60px 24px' }}>
        <div style={{ ...sectionStyle }}>
          <h2 className="reveal" style={{ color: '#fff', fontSize: 32, marginBottom: 48, textAlign: 'center', fontFamily: "'Playfair Display',serif" }}>{t.processTitle}</h2>
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
            {t.process?.map((step, i) => (
              <div key={i} className="reveal" data-delay={String(i + 1)} style={{ flex: '1 1 180px', textAlign: 'center', padding: '0 20px', position: 'relative' }}>
                {i < (t.process.length - 1) && showConnector && <div style={{ position: 'absolute', top: 24, [isRTL ? 'right' : 'left']: '60%', [isRTL ? 'left' : 'right']: '-10%', height: 1, background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, #FF6B35, #2a2a2a)`, opacity: 0.4 }} />}
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,107,53,0.15)', border: '2px solid #FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#FF6B35', fontWeight: 800, fontSize: 14 }}>{step.step}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{step.title}</div>
                <div style={{ color: '#8a8a8a', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ background: '#111', borderTop: '1px solid #1e1e1e', padding: '60px 24px' }}>
        <div style={{ ...sectionStyle, textAlign: 'center' }}>
          <h2 className="reveal" style={{ color: '#fff', fontSize: 32, marginBottom: 32, fontFamily: "'Playfair Display',serif" }}>{t.contactTitle}</h2>
          <div className="reveal" data-delay="1" style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 32px', color: '#888', fontSize: 15 }}>{t.location}</div>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 32px', color: '#888', fontSize: 15 }}>hello@sfalimshop.com</div>
          </div>
          <span className="reveal" data-delay="2">
            <MagneticButton onClick={() => setPage('order')} style={{ background: '#FF6B35', color: '#fff', border: 'none', padding: '16px 48px', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Varela Round',sans-serif", boxShadow: '0 0 30px rgba(255,107,53,0.4)', transition: 'box-shadow 0.3s' }}>
              {t.cta} →
            </MagneticButton>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============ CART TOAST — "added to cart" feedback bubble ============
// Bottom sheet on mobile (full-width, big tap target). Pill in the top
// inline-start corner on desktop. Auto-dismisses via the parent timer.
function CartToast({ message, lang, onClose, onViewCart, actionLabel, onAction }) {
  const isRTL = lang === "he";
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  // The default action is "View cart" — used by addBloomToCart / addMugStudioToCart.
  // Callers (e.g. the Share button on PetModal) can override with actionLabel/onAction
  // to swap in a different CTA — e.g. "Share on WhatsApp". When both are present,
  // they win over the legacy onViewCart wiring. If actionLabel is empty/null,
  // the action button is hidden entirely.
  const defaultLabel = lang === "he" ? "צפה בסל" : lang === "ru" ? "Открыть корзину" : "View cart";
  const buttonLabel = actionLabel !== undefined ? actionLabel : defaultLabel;
  const buttonHandler = onAction || onViewCart;
  const showButton = Boolean(buttonLabel && buttonHandler);
  return (
    <div
      role="status"
      aria-live="polite"
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        position: "fixed",
        bottom: isMobile ? 20 : "auto",
        top: isMobile ? "auto" : 90,
        insetInlineStart: isMobile ? 16 : "auto",
        insetInlineEnd: isMobile ? 16 : 20,
        width: isMobile ? "calc(100% - 32px)" : "auto",
        maxWidth: isMobile ? "none" : 380,
        background: "rgba(26,26,26,0.97)",
        color: "#fff",
        padding: isMobile ? "14px 16px" : "14px 18px",
        borderRadius: 14,
        border: `1px solid ${COLORS.accent}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,107,53,0.25)",
        backdropFilter: "blur(12px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "'Varela Round',sans-serif",
        animation: `${isMobile ? "cartToastInMobile" : "cartToastInDesktop"} 0.3s cubic-bezier(.2,.6,.2,1)`,
      }}>
      <span aria-hidden="true" style={{ color: "#4ade80", fontSize: 22, lineHeight: 1, flexShrink: 0 }}>✓</span>
      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.35 }}>{message}</span>
      {showButton && (
        <button onClick={buttonHandler} type="button" style={{
          background: COLORS.accentBtn, border: "none", color: "#fff",
          padding: isMobile ? "10px 14px" : "8px 14px",
          borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
          fontFamily: "'Varela Round',sans-serif", flexShrink: 0,
          minHeight: isMobile ? 40 : "auto", touchAction: "manipulation",
          transition: "background 0.2s",
        }}
        onMouseOver={e => e.currentTarget.style.background = COLORS.accentBtnHover}
        onMouseOut={e => e.currentTarget.style.background = COLORS.accentBtn}
        >{buttonLabel}</button>
      )}
      {!isMobile && (
        <button onClick={onClose} type="button" aria-label={lang === "he" ? "סגירה" : lang === "ru" ? "Закрыть" : "Dismiss"} style={{
          background: "transparent", border: "none", color: COLORS.gray, cursor: "pointer",
          fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );
}

// ============ CART DRAWER — slide-out cart, openable from anywhere ============
function CartDrawer({ lang, open, cart, setCart, updateCartQty, onClose, onCheckout }) {
  const isRTL = lang === "he";
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Fallback if the parent didn't pass an updater (defensive, e.g. older callers).
  const setQty = updateCartQty || ((id, q) => {
    if (q < 1) { setCart(c => c.filter(it => it.id !== id)); return; }
    setCart(c => c.map(it => {
      if (it.id !== id) return it;
      const unit = Number(it.unitPrice ?? it.itemPrice / Math.max(1, it.qty || 1)) || 0;
      return { ...it, qty: q, unitPrice: unit, itemPrice: unit * q };
    }));
  });

  // Big-enough tap target on mobile, compact on desktop.
  const qtyBtnStyle = {
    width: isMobile ? 40 : 30,
    height: isMobile ? 40 : 30,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgCard,
    color: COLORS.white,
    cursor: "pointer",
    fontSize: isMobile ? 20 : 16,
    lineHeight: 1,
    fontFamily: "'Varela Round',sans-serif",
    fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    touchAction: "manipulation",
    transition: "border-color 0.15s, color 0.15s",
  };

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // A11y: trap focus in the drawer while open; restore to the cart button on close.
  const cartDialogRef = useDialogFocus(open);

  const TR = {
    he: { title: "סל הקניות", empty: "הסל ריק", emptySub: "הוסיפו מוצרים כדי להתחיל", subtotal: "סכום ביניים", shipping: "משלוח", total: "סה״כ", checkout: "מעבר לתשלום", remove: "הסר", close: "סגירה" },
    en: { title: "Your cart", empty: "Your cart is empty", emptySub: "Add products to get started", subtotal: "Subtotal", shipping: "Shipping", total: "Total", checkout: "Proceed to checkout", remove: "Remove", close: "Close" },
    ru: { title: "Корзина", empty: "Корзина пуста", emptySub: "Добавьте товары, чтобы начать", subtotal: "Подытог", shipping: "Доставка", total: "Итого", checkout: "Перейти к оплате", remove: "Удалить", close: "Закрыть" },
  };
  const tr = TR[lang] || TR.en;

  const subtotal = cart.reduce((s, it) => s + it.itemPrice, 0);
  const shipping = cart.length > 0 ? SHIPPING_PRICE : 0;
  const total = subtotal + shipping;

  // Compact list of any print extras carried by a custom item.
  const extrasFor = (it) => [
    it.backPrint && (lang === "he" ? "הדפס אחורי" : lang === "ru" ? "Спина" : "Back print"),
    it.secondFront && it.secondFront.enabled && (lang === "he" ? "הדפס נוסף" : lang === "ru" ? "Доп. перед" : "Extra front"),
    it.sleeveLeft && it.sleeveLeft.enabled && (lang === "he" ? "שרוול שמאל" : lang === "ru" ? "Левый рукав" : "Left sleeve"),
    it.sleeveRight && it.sleeveRight.enabled && (lang === "he" ? "שרוול ימין" : lang === "ru" ? "Правый рукав" : "Right sleeve"),
  ].filter(Boolean).join(" · ");

  if (!open) return null;

  const __drawer = (
    <>
      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.6)",
        animation: "cartFade 0.25s ease",
      }} />

      {/* Panel */}
      <div ref={cartDialogRef} role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" style={{
        position: "fixed", top: 0, bottom: 0,
        insetInlineEnd: 0,
        zIndex: 1101,
        width: isMobile ? "100%" : 400, maxWidth: "100%",
        background: COLORS.bg,
        borderInlineStart: `1px solid ${COLORS.border}`,
        boxShadow: "0 0 60px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
        direction: isRTL ? "rtl" : "ltr",
        fontFamily: "'Varela Round',sans-serif",
        animation: `${isRTL ? "cartSlideL" : "cartSlideR"} 0.3s cubic-bezier(.2,.6,.2,1)`,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <div id="cart-drawer-title" style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700 }}>
            {`${tr.title}${cart.length > 0 ? ` (${cart.length})` : ""}`}
          </div>
          <button onClick={onClose} aria-label={tr.close} style={{
            width: 36, height: 36, borderRadius: "50%", background: "transparent",
            border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer",
            fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s", flexShrink: 0,
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; }}
          >×</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "70px 20px", color: COLORS.gray }}>
              <div style={{ fontSize: 46, marginBottom: 14 }}>🛒</div>
              <div style={{ color: COLORS.white, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{tr.empty}</div>
              <div style={{ fontSize: 13 }}>{tr.emptySub}</div>
            </div>
          ) : (
            cart.map((it) => {
              const extras = extrasFor(it);
              const qty = Number(it.qty) || 1;
              const unit = Number(it.unitPrice ?? (it.itemPrice / Math.max(1, qty))) || 0;
              return (
                <div key={it.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ width: isMobile ? 72 : 62, height: isMobile ? 72 : 62, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <SmartImage src={it.mockupUrl || it.uploadedImage || MOCKUP_URLS[it.productId]} alt={it.productName} style={{ width: "100%", height: "100%", objectFit: it.mockupUrl ? "cover" : "contain" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14 }}>{it.productName}</div>
                    {it.petName && <div style={{ color: it.petNameColor || COLORS.accent, fontFamily: `'${it.petNameFont || PET_NAME_FONT_DEFAULT}', sans-serif`, fontSize: 14, fontWeight: 700, marginTop: 4 }} dir={hasHebrew(it.petName) ? `rtl` : `ltr`}>🐾 {it.petName} (+₪{PET_NAME_SURCHARGE})</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, color: COLORS.gray, fontSize: 12.5, flexWrap: "wrap" }}>
                      {it.variantLabel && <span>{it.variantLabel}</span>}
                      {it.color && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span aria-hidden="true" style={{ width: 13, height: 13, borderRadius: "50%", background: it.color, border: "1px solid rgba(255,255,255,0.3)", display: "inline-block", flexShrink: 0 }} />
                          <span>{colorName(it.color, lang)}</span>
                        </span>
                      )}
                    </div>
                    {extras && <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 4 }}>{extras}</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, direction: "ltr" }}>
                        <button type="button" onClick={() => setQty(it.id, qty - 1)} aria-label={lang === "he" ? "הפחת" : lang === "ru" ? "Уменьшить" : "Decrease"} style={qtyBtnStyle}>−</button>
                        <span aria-live="polite" style={{ minWidth: 26, textAlign: "center", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 15 }}>{qty}</span>
                        <button type="button" onClick={() => setQty(it.id, qty + 1)} aria-label={lang === "he" ? "הוסף" : lang === "ru" ? "Увеличить" : "Increase"} style={qtyBtnStyle}>+</button>
                      </div>
                      <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 14, fontFamily: "'Varela Round',sans-serif", direction: "ltr" }}>
                        {qty > 1 ? `₪${unit} × ${qty} = ₪${unit * qty}` : `₪${unit * qty}`}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setCart(c => c.filter(x => x.id !== it.id))} aria-label={tr.remove} style={{
                    background: "transparent", border: "none", color: COLORS.gray,
                    cursor: "pointer", fontSize: isMobile ? 22 : 20, lineHeight: 1, padding: isMobile ? 8 : 4,
                    minWidth: isMobile ? 40 : "auto", minHeight: isMobile ? 40 : "auto",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "color 0.2s", touchAction: "manipulation",
                  }}
                  onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseOut={e => e.currentTarget.style.color = COLORS.gray}
                  >🗑</button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — totals + checkout. On mobile this stays glued to the bottom
            (it's a flex item that never shrinks); paddingBottom respects iOS
            safe-area inset so the button isn't covered by the home indicator. */}
        {cart.length > 0 && (
          <div style={{
            flexShrink: 0,
            borderTop: `1px solid ${COLORS.border}`,
            padding: isMobile ? "16px 18px calc(16px + env(safe-area-inset-bottom)) 18px" : "18px 22px",
            background: COLORS.bgCard,
            boxShadow: isMobile ? "0 -8px 24px rgba(0,0,0,0.3)" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 7 }}>
              <span>{tr.subtotal}</span><span>{`₪${subtotal}`}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 11 }}>
              <span>{tr.shipping}</span><span>{`₪${shipping}`}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 11, borderTop: `1px solid ${COLORS.border}`, marginBottom: 15 }}>
              <span style={{ color: COLORS.white, fontWeight: 700, fontSize: 15 }}>{tr.total}</span>
              <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 22, fontFamily: "'Playfair Display',serif" }}>{`₪${total}`}</span>
            </div>
            {/* Trust strip — supports the buying decision right by the checkout CTA */}
            <div style={{ marginBottom: 15 }}><TrustStrip lang={lang} /></div>
            <button onClick={onCheckout} style={{
              width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none",
              borderRadius: 12, padding: isMobile ? "16px" : "15px", fontSize: 16, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Varela Round',sans-serif", boxShadow: "0 6px 20px rgba(255,107,53,0.35)",
              transition: "background 0.2s", touchAction: "manipulation",
            }}
            onMouseOver={e => e.currentTarget.style.background = COLORS.accentBtnHover}
            onMouseOut={e => e.currentTarget.style.background = COLORS.accentBtn}
            >{tr.checkout}</button>
          </div>
        )}

        <style>{`
          @keyframes cartFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cartSlideR { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes cartSlideL { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>
      </div>
    </>
  );
  // Portal the drawer to <body> so a filtered #root (high-contrast) can't become
  // its containing block and push the fixed drawer off-screen.
  return typeof document !== `undefined` ? createPortal(__drawer, document.body) : __drawer;
}

// 404 — shown for any non-empty hash route that matches no known page. Trilingual,
// RTL-aware, offers a way back home + into the BLOOM gallery.
function NotFoundPage({ lang, setPage }) {
  const isRTL = lang === `he`;
  const title = lang === `he` ? `הדף לא נמצא` : lang === `ru` ? `Страница не найдена` : `Page not found`;
  const body = lang === `he`
    ? `לא הצלחנו למצוא את העמוד שחיפשתם. ייתכן שהקישור שגוי או שהדף הוסר.`
    : lang === `ru`
      ? `Мы не нашли запрашиваемую страницу. Возможно, ссылка неверна или страница удалена.`
      : `We couldn't find the page you were looking for. The link may be broken or the page may have moved.`;
  const homeBtn = lang === `he` ? `חזרה לדף הבית` : lang === `ru` ? `На главную` : `Back home`;
  const petsBtn = lang === `he` ? `לאוסף BLOOM` : lang === `ru` ? `Коллекция BLOOM` : `Browse BLOOM`;
  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `70vh`, paddingTop: 72, direction: isRTL ? `rtl` : `ltr`, display: `flex`, alignItems: `center`, justifyContent: `center` }}>
      <div style={{ textAlign: `center`, padding: `60px 24px`, maxWidth: 560 }}>
        <div style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 900, fontSize: `5rem`, color: COLORS.accent, lineHeight: 1, marginBottom: 12 }}>404</div>
        <h1 style={{ fontFamily: `'Playfair Display',serif`, fontWeight: 700, fontSize: `1.8rem`, color: COLORS.white, margin: `0 0 12px` }}>{title}</h1>
        <p style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 16, lineHeight: 1.6, margin: `0 0 28px` }}>{body}</p>
        <div style={{ display: `flex`, gap: 12, justifyContent: `center`, flexWrap: `wrap` }}>
          <button type="button" onClick={() => setPage(`home`)} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 999, padding: `12px 28px`, fontSize: 15, fontWeight: 700, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{homeBtn}</button>
          <button type="button" onClick={() => setPage(`pets`)} style={{ background: `transparent`, color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: `12px 28px`, fontSize: 15, fontWeight: 700, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{petsBtn}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
 const VALID_PAGES = ['home', 'order', 'track', 'auth', 'admin', 'about', 'pets', 'breed', 'blog', 'faq', 'policies', 'reset-password', ...(MUG_STUDIO_ENABLED ? ['mug-studio'] : [])];

  // Clean URL paths → policy section IDs (for Google verification + SEO)
  const PATH_TO_POLICY_SECTION = {
    '/privacy': 'privacy',
    '/terms': 'terms',
    '/refunds': 'refund',
    '/shipping': 'shipping',
    '/accessibility': 'accessibility',
  };

  const getPageFromURL = () => {
    if (typeof window === 'undefined') return 'home';
    if (PATH_TO_POLICY_SECTION[window.location.pathname]) return 'policies';
    // Tolerate an optional leading slash after the hash (#/blog as well as
    // #blog) so the canonical #/blog/<slug> share/OG/sitemap URLs resolve too.
    // Existing routes (#pets, #order, #policies/...) have no leading slash and
    // are unaffected.
    const hash = rawHash().replace('#', '').replace(/^\//, '');
    const root = hash.split('/')[0].split('?')[0];
    // Empty hash = home. A non-empty hash that matches no known route gets a
    // real 404 page (was silently falling back to 'home', which masked broken
    // links). Scroll/anchor hashes all use known roots (pets/policies/...), so
    // they're unaffected.
    if (root === '') return 'home';
    // Supabase auth callbacks can drop tokens straight into the hash
    // (#access_token=...&type=recovery in implicit flow, or an OAuth error). Never
    // 404 those — fall back to home and let the SDK consume + clean the URL.
    if (/(access_token|refresh_token|provider_token|error_code|error_description)=/.test(hash)) return 'home';
    return VALID_PAGES.includes(root) ? root : 'not-found';
  };

  const getPageFromHash = getPageFromURL;

  const [page, setPageState] = useState(getPageFromURL);
  // Blog sub-route slug (null = blog index). Kept in its own state because the
  // app router is popstate/state-driven (not hashchange), so navigating between
  // posts needs an explicit state change to re-render + re-fetch.
  const [blogSlug, setBlogSlug] = useState(parseBlogSlugFromHash);
  // Breed sub-route slug (#/breed/<slug>). Own state for the same reason as
  // blogSlug — the router is popstate/state-driven, so navigating between
  // breeds needs an explicit state change to re-render + re-fetch.
  const [breedSlug, setBreedSlug] = useState(parseBreedSlugFromHash);
  const [lang, setLang] = useState("he");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // 🔐 Staff maintenance bypass. A plain ?staff=1 no longer bypasses on its own —
  // staff must enter VITE_STAFF_PASSWORD on the maintenance page, which sets a
  // sessionStorage flag (sf_staff). This state mirrors that flag so a refresh
  // within the same tab session keeps staff in. Session-scoped on purpose.
  const [staffUnlocked, setStaffUnlocked] = useState(() =>
    typeof window !== "undefined" && window.sessionStorage.getItem("sf_staff") === "1");
  const [pendingBloomItem, setPendingBloomItem] = useState(null);

  // Always open at the very top on load/refresh. The browser otherwise
  // restores the previous scroll position on reload; we disable that and
  // force the top once on initial mount. In-app navigation is unaffected.
  useEffect(() => {
    if (typeof window === `undefined`) return;
    if (`scrollRestoration` in window.history) window.history.scrollRestoration = `manual`;
    window.scrollTo(0, 0);
  }, []);

  // The order cart lives here (not inside OrderPage) so it survives navigation
  // between the BLOOM collection and the order page while shopping. It's also
  // persisted to localStorage (hydrated lazily on mount, written on every
  // change) so a tab reload or accidental browser-close doesn't wipe what
  // the customer has been assembling. In-memory state stays the source of
  // truth; localStorage is just a mirror. Cart items can contain large
  // data-URL design/mockup blobs (multi-MB), so the writer is wrapped in a
  // try/catch — on QuotaExceeded we fail silently rather than crash the app.
  const [cart, setCart] = useState(() => {
    if (typeof window === `undefined`) return [];
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window === `undefined`) return;
    try {
      if (cart.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
      else window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // QuotaExceeded — likely a cart with several large data-URL mockups.
      // Persistence is a nice-to-have; the in-memory cart still works.
    }
  }, [cart]);
  // Wipe the cart completely — in-memory state AND the localStorage mirror.
  // Called ONLY on a confirmed-succeeded payment return (see TrackPage), so
  // purchased items don't linger after checkout. setCart([]) already triggers the
  // effect above to remove the key; we also remove it directly to be certain.
  const clearCart = () => {
    setCart([]);
    try { window.localStorage.removeItem(CART_STORAGE_KEY); } catch (_) {}
  };
  const [cartOpen, setCartOpen] = useState(false);
  // True once the user has explicitly closed the cart drawer (or proceeded to
  // checkout from it). The /order auto-open effect respects this flag so the
  // drawer doesn't reopen behind the user's back. Re-opening the cart from
  // the nav icon or the toast resets it.
  const [userClosedCart, setUserClosedCart] = useState(false);
  // When true, OrderPage opens straight on the checkout details step.
  const [pendingCheckout, setPendingCheckout] = useState(false);
  // Lifted from AccessibilityMenu so the background animation components
  // (ParticlesBackground, CursorGlow) can be skipped entirely when on.
  const [reduceMotion, setReduceMotion] = useState(false);

  // SPA focus management + route announcement (a11y). On a client-side route
  // change we move keyboard focus into <main> and announce the new page to
  // screen readers (complements the existing <title> update). The first render
  // is skipped so we don't yank focus on initial load.
  const mainRef = useRef(null);
  const isFirstRoute = useRef(true);
  const [routeAnnounce, setRouteAnnounce] = useState(``);
  useEffect(() => {
    if (isFirstRoute.current) { isFirstRoute.current = false; return; }
    const el = mainRef.current;
    if (el) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    // Announce after the title effect has run for this route.
    try { setRouteAnnounce(``); const id = requestAnimationFrame(() => setRouteAnnounce(document.title || ``)); return () => cancelAnimationFrame(id); } catch (_) {}
  }, [page, blogSlug, breedSlug]);

  // Centralised open/close helpers — every caller that touches cartOpen
  // should go through these so userClosedCart stays accurate.
  const openCart = () => { setCartOpen(true); setUserClosedCart(false); };
  const closeCart = () => { setCartOpen(false); setUserClosedCart(true); };

  // Cart auto-open on /order was useful before the inline OrderSummary existed.
  // Now that step 3 has a sticky summary column (and a collapsible bar on
  // mobile), the drawer would just be redundant noise — disabled on purpose.
  // The user can still open the drawer manually from the nav icon if they want.

  const setPage = (newPage) => {
    // Support sub-routes like "pets/<slug>" — store only the root in React state
    // so page === "pets" checks still match, while the URL hash keeps the full path
    // so route-aware pages (e.g. PetsPage) can read the slug via window.location.hash.
    const root = String(newPage).split('/')[0];
    const hash = root === 'home' ? '' : newPage;
    window.history.pushState({ page: root }, '', `#${hash}`);
    setPageState(root);
  };

  // Blog navigation. slug = a post slug (opens BlogPost) or null/undefined
  // (opens BlogIndex). Uses the canonical #/blog and #/blog/<slug> form so the
  // same URLs work when shared (OG/sitemap). Drives both page + blogSlug state.
  const goToBlog = (slug) => {
    const target = slug ? `blog/${slug}` : `blog`;
    window.history.pushState({ page: 'blog', blogSlug: slug || null }, '', `#/${target}`);
    setBlogSlug(slug || null);
    setPageState('blog');
    window.scrollTo(0, 0);
  };

  // Breed-page navigation. slug = a pet_designs.slug → opens BreedPage at the
  // canonical #/breed/<slug> form (so the URL is shareable). Drives both page +
  // breedSlug state, like goToBlog.
  const goToBreed = (slug) => {
    if (!slug) return;
    window.history.pushState({ page: 'breed', breedSlug: slug }, '', `#/breed/${slug}`);
    setBreedSlug(slug);
    setPageState('breed');
    window.scrollTo(0, 0);
  };

  // Hand a ready-made BLOOM item to OrderPage's cart, then jump to the order page.
  // Kept for the legacy "go straight to checkout" path — the BLOOM modal no
  // longer uses it; it calls addBloomToCart directly so the user stays on /pets.
  const orderBloomDesign = (item) => {
    setPendingBloomItem(item);
    setPage("order");
  };

  // Short-lived toast shown after a BLOOM item is added to the cart from /pets.
  // null when hidden, otherwise the localized message string.
  const [cartToast, setCartToast] = useState(null);
  const cartToastTimer = useRef(null);

  // Optional CTA override for the toast. null → use the toast's built-in
  // "View cart" default (existing add-to-cart behavior). An object overrides
  // both the button label and click handler — used by the Share flow to
  // surface a "Share on WhatsApp" action alongside "Link copied!".
  const [cartToastAction, setCartToastAction] = useState(null);

  // Shared toast helper for messages that need a custom CTA (e.g. Share →
  // "Link copied" with a WhatsApp shortcut). Existing addBloomToCart /
  // addMugStudioToCart paths still set cartToast inline because they want
  // the default "View cart" action — those don't need to change.
  const showToast = useCallback((message, action) => {
    setCartToast(message);
    setCartToastAction(action || null);
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    cartToastTimer.current = setTimeout(() => { setCartToast(null); setCartToastAction(null); }, 3000);
  }, []);

  // Build the same cart item OrderPage builds when it consumes pendingBloomItem,
  // and push it to the shared cart so the user can keep browsing BLOOM.
  // unitPrice is stored separately from itemPrice so CartDrawer +/- can
  // recompute itemPrice = unitPrice × qty without re-running this builder.
  const addBloomToCart = (item) => {
    const tNow = LANGS[lang] || LANGS.he;
    const prod = PRODUCTS(tNow).find(p => p.id === item.productId);
    if (!prod || !prod.variants.length) return;
    const v = (item.variantId && prod.variants.find(x => x.id === item.variantId)) || prod.variants[0];
    const colorHex = item.shirtColor ? item.shirtColor.hex : prod.colors[0];
    const matchedIdx = prod.colors.indexOf(colorHex);
    const unitPrice = Number(item.price) || 0;
    const cartItem = {
      id: Date.now() + Math.random(),
      productId: prod.id,
      productName: item.characterName ? `${prod.name} · ${item.characterName}` : prod.name,
      variantId: v.id,
      variantLabel: v.label,
      colorIdx: matchedIdx >= 0 ? matchedIdx : 0,
      color: colorHex,
      qty: 1,
      uploadedImage: item.designUrl,
      mockupUrl: item.mockupUrl || null,
      petName: item.petName || null,
      petNameFont: item.petNameFont || null,
      petNameColor: item.petNameColor || null,
      imagePos: { x: 150, y: 130, size: 85 },
      backPrint: false,
      backDesign: { enabled: false, sameAsMain: true, image: null },
      secondFront: { enabled: false, image: null, sameAsMain: true, pos: { x: 210, y: 120, size: 43 } },
      sleeveLeft: { enabled: false, sameAsMain: true, image: null },
      sleeveRight: { enabled: false, sameAsMain: true, image: null },
      unitPrice,
      itemPrice: unitPrice,
    };
    setCart(c => [...c, cartItem]);

    // Toast: include the product name and a CTA to open the cart drawer.
    const productLabel = cartItem.productName;
    const tmpl = lang === "he" ? `${productLabel} נוסף לסל!` : lang === "ru" ? `${productLabel} добавлен в корзину!` : `${productLabel} added to cart!`;
    showToast(tmpl);
  };

  // BLOOM sticker pack → cart. Packs are a standalone product (no design
  // upload, no customizer), so we build the same line-item shape the rest of
  // the cart code consumes but with safe defaults for the shirt-style fields.
  // The pack image goes in mockupUrl so the cart drawer + order summary show
  // it; the pack identity (slug + items list) is preserved on cartItem.stickerPack
  // for the order-insert branch and for any future admin/fulfilment hooks.
  const addStickerPackToCart = (pack) => {
    if (!pack) return;
    const packName = pack[`name_${lang}`] || pack.name_he || pack.name_en || `Sticker Pack`;
    const unitPrice = Number(pack.price) || 35;
    const cartItem = {
      id: Date.now() + Math.random(),
      productId: `sticker_pack`,
      productName: packName,
      // variantId carries the pack slug so checkout/admin can resolve it.
      variantId: pack.slug || `pack`,
      variantLabel: packName,
      colorIdx: 0,
      color: null,
      qty: 1,
      uploadedImage: null,
      mockupUrl: pack.image_url || null,
      // Shirt-style fields kept at safe defaults — they're never read for a
      // sticker_pack but the cart UI/order-insert code touches some of them.
      imagePos: { x: 0, y: 0, size: 0 },
      backPrint: false,
      backDesign: { enabled: false, sameAsMain: true, image: null },
      secondFront: { enabled: false, image: null, sameAsMain: true, pos: { x: 0, y: 0, size: 0 } },
      sleeveLeft: { enabled: false, sameAsMain: true, image: null },
      sleeveRight: { enabled: false, sameAsMain: true, image: null },
      stickerPack: {
        slug: pack.slug || ``,
        species: pack.species || ``,
        items: Array.isArray(pack.item_slugs) ? pack.item_slugs : [],
        imageUrl: pack.image_url || null,
      },
      unitPrice,
      itemPrice: unitPrice,
    };
    setCart(c => [...c, cartItem]);
    const tmpl = lang === `he`
      ? `${packName} נוסף לסל!`
      : lang === `ru`
        ? `${packName} добавлен в корзину!`
        : `${packName} added to cart!`;
    showToast(tmpl);
  };

  // Mug Studio → cart. Mirrors the BLOOM/shirt pattern: the cart line carries
  // the customer-arranged mockup (mockupUrl) AND the print-ready 300dpi flat
  // PNG (uploadedImage). The existing OrderPage checkout submit already
  // uploads both via uploadDesignImage → orders.mockup_url + orders.design_url,
  // and the admin order view already shows mockup_url as the preview
  // thumbnail with design_url available as a download link — no schema
  // changes needed. mugStudio.layers carries the per-layer transform JSON
  // locally so the layout is reproducible from sources if we ever wire it to DB.
  const addMugStudioToCart = (payload) => {
    // Hard-gated by MUG_STUDIO_ENABLED so the helper no-ops when the
    // route is disabled — even if something still holds a stale ref.
    if (!MUG_STUDIO_ENABLED) return;
    const tNow = LANGS[lang] || LANGS.he;
    const prod = PRODUCTS(tNow).find(p => p.id === `mug`);
    if (!prod || !prod.variants.length) return;
    const v = prod.variants[0];
    const colorHex = prod.colors[0];
    const unitPrice = Number(v.price) || 0;
    const cartItem = {
      id: Date.now() + Math.random(),
      productId: prod.id,
      productName: prod.name,
      variantId: v.id,
      variantLabel: v.label,
      colorIdx: 0,
      color: colorHex,
      qty: 1,
      uploadedImage: payload.printPng || null,
      mockupUrl: payload.mockupPng || null,
      // Existing shirt-schema fields kept at safe defaults — the mug's print
      // layout is baked into uploadedImage (the 300dpi PNG), so the admin's
      // shirt-style re-compositor isn't used for this product.
      imagePos: { x: 200, y: 150, size: 100 },
      backPrint: false,
      backDesign: { enabled: false, sameAsMain: true, image: null },
      secondFront: { enabled: false, image: null, sameAsMain: true, pos: { x: 210, y: 120, size: 43 } },
      sleeveLeft: { enabled: false, sameAsMain: true, image: null },
      sleeveRight: { enabled: false, sameAsMain: true, image: null },
      mugStudio: {
        layers: payload.layers || [],
        printArea: payload.printArea || null,
      },
      unitPrice,
      itemPrice: unitPrice,
    };
    setCart(c => [...c, cartItem]);

    const productLabel = cartItem.productName;
    const tmpl = lang === "he" ? `${productLabel} נוסף לסל!` : lang === "ru" ? `${productLabel} добавлен в корзину!` : `${productLabel} added to cart!`;
    showToast(tmpl);
  };

  // Cart line update — used by the CartDrawer +/- buttons. Drops the line
  // entirely when qty falls below 1, otherwise recomputes itemPrice.
  const updateCartQty = (itemId, newQty) => {
    if (newQty < 1) {
      setCart(c => c.filter(it => it.id !== itemId));
      return;
    }
    setCart(c => c.map(it => {
      if (it.id !== itemId) return it;
      const unit = Number(it.unitPrice ?? it.itemPrice / Math.max(1, it.qty || 1)) || 0;
      return { ...it, qty: newQty, unitPrice: unit, itemPrice: unit * newQty };
    }));
  };

  useEffect(() => () => { if (cartToastTimer.current) clearTimeout(cartToastTimer.current); }, []);

  // Open the order page on the checkout step — used by the cart drawer.
  // The user explicitly chose to proceed, so close the cart AND mark it as
  // user-closed; otherwise the auto-open effect would reopen it on /order.
  const goToCheckout = () => {
    closeCart();
    setPendingCheckout(true);
    if (page !== "order") setPage("order");
  };

  useEffect(() => {
    // Convert clean policy paths (/privacy, /terms etc.) to hash form so internal routing works
    const section = PATH_TO_POLICY_SECTION[window.location.pathname];
    if (section) {
      window.history.replaceState({ page: 'policies' }, '', `/#policies/${section}`);
    }

    // Handle browser back/forward button
    const handlePopState = (e) => {
      const newPage = e.state?.page || getPageFromHash();
      setPageState(newPage);
      if (newPage === 'blog') setBlogSlug(e.state?.blogSlug ?? parseBlogSlugFromHash());
      if (newPage === 'breed') setBreedSlug(e.state?.breedSlug ?? parseBreedSlugFromHash());
    };
    // hashchange fires for plain <a href="#..."> navigation (e.g. an in-article
    // blog link to "/#/pets?slug=..."). The app's own setPage/pushState helpers
    // don't fire it, so this only handles anchor-driven hash changes — it syncs
    // the page (and blog slug) from the URL. Idempotent with popstate.
    const handleHashChange = () => {
      const newPage = getPageFromHash();
      setPageState(newPage);
      if (newPage === 'blog') setBlogSlug(parseBlogSlugFromHash());
      if (newPage === 'breed') setBreedSlug(parseBreedSlugFromHash());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    // Set initial history state
    const current = getPageFromHash();
    window.history.replaceState({ page: current }, '', window.location.href);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // ============ SCROLL REVEAL — observe all .reveal elements on every page change ============
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".reveal").forEach(el => el.classList.add("revealed"));
      return;
    }
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    // Track per-batch fallback timers so we can clear them on cleanup.
    const batchTimers = new Set();

    // Attach the IntersectionObserver to a batch of newly-discovered
    // .reveal nodes and ALSO schedule a 1.5s force-reveal so nothing in
    // this batch can stay invisible — important for async-mounted content
    // (Supabase-driven BLOOM carousel, reviews, pet cards) that arrives
    // after the initial DOM scan and might never intersect (e.g. mounted
    // already above the fold while the user is scrolled down).
    const trackBatch = (nodes) => {
      if (!nodes.length) return;
      nodes.forEach(el => observer.observe(el));
      const tid = setTimeout(() => {
        nodes.forEach(el => el.classList.add("revealed"));
        batchTimers.delete(tid);
      }, 1500);
      batchTimers.add(tid);
    };

    // Initial scan after the page swap finishes mounting.
    const initialTimer = setTimeout(() => {
      const initial = Array.from(document.querySelectorAll(".reveal:not(.revealed)"));
      trackBatch(initial);
    }, 50);

    // Safety net for the very first render: force-reveal anything still
    // hidden after 1.5s. Backstop for the rare case where the IO never
    // attaches (very slow scripts, broken page swap, etc).
    const safetyTimer = setTimeout(() => {
      document.querySelectorAll(".reveal:not(.revealed)").forEach(el => el.classList.add("revealed"));
    }, 1500);

    // MutationObserver picks up .reveal nodes added by async data fetches
    // (e.g. BLOOM character cards from Supabase). Each batch is observed
    // AND given its own 1.5s force-reveal fallback via trackBatch().
    const mo = new MutationObserver(mutations => {
      const found = [];
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains("reveal") && !node.classList.contains("revealed")) {
            found.push(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll(".reveal:not(.revealed)").forEach(el => found.push(el));
          }
        });
      });
      if (found.length) trackBatch(found);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(safetyTimer);
      batchTimers.forEach(tid => clearTimeout(tid));
      batchTimers.clear();
      observer.disconnect();
      mo.disconnect();
    };
  }, [page]);

  // ============ DYNAMIC PAGE TITLES + SEO ============
  useEffect(() => {
    const titles = {
      he: {
        home:     "ספלים שופ | הדפסות מותאמות אישית — חולצות, ספלים, מדבקות",
        order:    "הזמן עיצוב משלך | ספלים שופ",
        pets:     "BLOOM Collection | אוסף דיוקנאות חיות מחמד | ספלים שופ",
        about:    "על ספלים שופ | מי אנחנו",
        track:    "מעקב הזמנות | ספלים שופ",
        admin:    "ניהול | ספלים שופ",
        faq:      "שאלות נפוצות | ספלים שופ",
        policies: "מידע משפטי | ספלים שופ",
      },
      en: {
        home:     "Sfalim Shop | Custom Prints — Shirts, Mugs, Stickers",
        order:    "Design Your Order | Sfalim Shop",
        pets:     "BLOOM Collection | Pet Couture by Sfalim Shop",
        about:    "About Sfalim Shop",
        track:    "Track Orders | Sfalim Shop",
        admin:    "Admin | Sfalim Shop",
        faq:      "FAQ | Sfalim Shop",
        policies: "Legal | Sfalim Shop",
      },
      ru: {
        home:     "Sfalim Shop | Индивидуальная печать — футболки, кружки, стикеры",
        order:    "Создать заказ | Sfalim Shop",
        pets:     "BLOOM Collection | Pet Couture от Sfalim Shop",
        about:    "О Sfalim Shop",
        track:    "Отслеживание заказов | Sfalim Shop",
        admin:    "Админ | Sfalim Shop",
        faq:      "Частые вопросы | Sfalim Shop",
        policies: "Правовая информация | Sfalim Shop",
      },
    };
    const langTitles = titles[lang] || titles.he;
    // The blog pages (index + post), breed pages and the FAQ page set their own
    // full SEO (title + description + OG + JSON-LD) in their components — don't
    // clobber it here. For every OTHER route, restore the generic site SEO so a
    // breed/post/FAQ's tags never leak across navigation.
    if (page !== "blog" && page !== "breed" && page !== "faq") {
      const title = langTitles[page] || langTitles.home;
      document.title = title;
      const viewDesc = (VIEW_SEO_DESC[lang] || VIEW_SEO_DESC.he)[page];
      setGenericSeo(lang, title, viewDesc);
    }
    // Update html lang+dir to match current selection
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [page, lang]);

  // ============ ANALYTICS LOADER — fires only after cookie consent ============
  const [cookieConsent, setCookieConsent] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sxp_cookie_consent");
  });
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    // Show banner after a short delay if not yet consented
    if (cookieConsent === null) {
      const timer = setTimeout(() => setShowCookieBanner(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [cookieConsent]);

  useEffect(() => {
    // Inject GA4 and FB Pixel only after consent === "accepted"
    if (cookieConsent !== "accepted") return;
    if (typeof window === "undefined") return;

    // ---- Google Analytics 4 ----
    if (ANALYTICS.ga4 && !window.__ga4Loaded) {
      window.__ga4Loaded = true;
      const s1 = document.createElement("script");
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.ga4}`;
      document.head.appendChild(s1);
      window.dataLayer = window.dataLayer || [];
      function gtag(){ window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", ANALYTICS.ga4, { anonymize_ip: true });
    }

    // ---- Facebook Pixel ----
    if (ANALYTICS.fbPixel && !window.__fbpLoaded) {
      window.__fbpLoaded = true;
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
      }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", ANALYTICS.fbPixel);
      window.fbq("track", "PageView");
    }
  }, [cookieConsent]);

  // Track page changes (after first load) — fires PageView for both analytics
  useEffect(() => {
    if (cookieConsent !== "accepted") return;
    if (typeof window === "undefined") return;
    if (window.gtag && ANALYTICS.ga4) {
      window.gtag("event", "page_view", { page_path: `/${page === "home" ? "" : page}` });
    }
    if (window.fbq && ANALYTICS.fbPixel) {
      window.fbq("track", "PageView");
    }
  }, [page, cookieConsent]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); checkAdmin(session.user); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        checkAdmin(session.user);
        // Returning from a guest order-tracking magic link → land on the orders page.
        if (localStorage.getItem("sxp_track_after_login") === "1") {
          localStorage.removeItem("sxp_track_after_login");
          setPage("track");
        }
      } else setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (u) => {
    const { data } = await supabase.from("admins").select("id").eq("id", u.id).single();
    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setIsAdmin(false); setPage("home");
  };

  const handleAuth = (u) => {
    setUser(u); checkAdmin(u);
    setPage(u.email === ADMIN_EMAIL ? "admin" : "track");
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <Analytics />
      <SpeedInsights />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

        /* WCAG 2.4.7 — visible keyboard focus. Mouse clicks suppressed via :focus-visible. */
        :focus { outline: none; }
        :focus-visible { outline: 2px solid #FF6B35 !important; outline-offset: 2px !important; }
        input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid #FF6B35 !important; outline-offset: 2px !important; }
        /* WCAG 2.4.1 — skip to content. Off-screen until focused, then pinned top-center. */
        .skip-link { position: fixed; top: -100px; inset-inline-start: 50%; transform: translateX(-50%); z-index: 10000; background: #C0501A; color: #fff; padding: 12px 22px; border-radius: 0 0 10px 10px; font-family: 'Varela Round', sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; transition: top 0.15s ease; }
        .skip-link:focus { top: 0; outline: 2px solid #fff; outline-offset: 2px; }
        /* iOS Safari auto-zooms when a focused input's font-size is < 16px. The
           form inputs use 13–14px; force >=16px on small screens so no field
           triggers the zoom. Desktop keeps its original sizing (media-scoped). */
        @media (max-width: 768px) {
          input, textarea, select { font-size: 16px !important; }
        }

        /* === Premium Animations === */

        /* Trust badge: staggered entry + breathing pulse on icon */
        @keyframes badgeFadeIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes iconBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(255,107,53,0)); }
          50%      { transform: scale(1.08); filter: drop-shadow(0 0 6px rgba(255,107,53,0.45)); }
        }
        @keyframes iconShimmer {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.65; }
        }
        @keyframes iconRotate {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(-12deg); }
          75%  { transform: rotate(12deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes iconBounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes maintPulse {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 30px rgba(255,107,53,0.7); }
          50%      { transform: scale(1.5); opacity: 0.6; box-shadow: 0 0 50px rgba(255,107,53,0.9); }
        }
        @keyframes cookieRise {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* ============ MAGNETIC CTA + Glow on hover ============ */
        .magnetic-zone { -webkit-tap-highlight-color: transparent; }
        .magnetic-btn { position: relative; will-change: transform; }
        .magnetic-btn.magnetic-active { box-shadow: 0 0 28px rgba(255,107,53,0.55), 0 8px 28px rgba(0,0,0,0.35) !important; }
        @media (hover: none) { .magnetic-btn { transform: none !important; } }
        @media (prefers-reduced-motion: reduce) { .magnetic-btn { transform: none !important; transition: none !important; } }

        /* ============ WhatsApp floating button ============ */
        /* Subtle hover scale only (no continuous bounce); suppressed entirely
           under reduced motion. The a11y "reduce motion" toggle also kills it. */
        .wa-fab:focus-visible { outline: 2px solid #FF6B35 !important; outline-offset: 3px !important; }
        @media (prefers-reduced-motion: no-preference) { .wa-fab { transition: transform 0.2s, box-shadow 0.2s; } }
        @media (prefers-reduced-motion: reduce) { .wa-fab { transition: none !important; } }

        /* ============ SCROLL REVEAL — fade up on intersection ============ */
        .reveal {
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 1.0s cubic-bezier(0.16, 1, 0.3, 1), transform 1.0s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        .reveal.revealed { opacity: 1; transform: translateY(0); will-change: auto; }
        .reveal[data-delay="1"] { transition-delay: 0.10s; }
        .reveal[data-delay="2"] { transition-delay: 0.20s; }
        .reveal[data-delay="3"] { transition-delay: 0.30s; }
        .reveal[data-delay="4"] { transition-delay: 0.40s; }
        .reveal[data-delay="5"] { transition-delay: 0.50s; }
        .reveal[data-delay="6"] { transition-delay: 0.60s; }
        @media (prefers-reduced-motion: reduce) {
          .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* Image-load-driven reveal for the home BLOOM carousel card.
           Same visual feel as .reveal but flipped imperatively by React
           when the SmartImage's onLoad fires (or the 2s safety timer). */
        .bloom-card-reveal {
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 1.0s cubic-bezier(0.16, 1, 0.3, 1), transform 1.0s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bloom-card-reveal.is-in { opacity: 1; transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .bloom-card-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* PetModal's circular nav arrows — kept globally so the hover glow,
           press scale, and focus ring work on every page where they are
           rendered. Don't reuse this class for new bare arrows; the !important
           rules below would force the dark background back on. */
        .bloom-nav-btn:hover { background: rgba(0,0,0,0.7) !important; color: #fff !important; transform: translateY(-50%) scale(1.15) !important; box-shadow: 0 0 24px rgba(255,107,53,0.5); }
        .bloom-nav-btn:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; }
        .bloom-nav-btn:active { transform: translateY(-50%) scale(1.05) !important; }

        /* Bare chevron buttons used in the home BLOOM carousel — no circular
           background, sit in the gutters just outside the card edges.
           Hover/active force translateY(-50%) with !important to keep the
           vertical centering that the inline absolute positioning relies on
           (otherwise the bare scale() transform would replace it and the
           arrow would jump down). */
        .bloom-home-arrow { background: transparent; border: none; cursor: pointer; color: #FF6B35; transition: transform 0.18s cubic-bezier(.2,.6,.2,1), color 0.18s; }
        .bloom-home-arrow:hover { color: #fff; transform: translateY(-50%) scale(1.2) !important; }
        .bloom-home-arrow:active { transform: translateY(-50%) scale(1.05) !important; }
        .bloom-home-arrow:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; }

        .trust-badge {
          opacity: 0;
          animation: badgeFadeIn 0.5s cubic-bezier(.2,.6,.2,1) forwards;
          transition: transform 0.25s cubic-bezier(.2,.6,.2,1), border-color 0.25s, background 0.25s;
        }
        .trust-badge:hover {
          transform: translateY(-3px);
          border-color: #FF6B35 !important;
          background: rgba(255,107,53,0.05) !important;
        }
        .trust-badge .badge-icon {
          display: inline-block;
          transform-origin: center;
        }
        .trust-badge:nth-child(1) { animation-delay: 0.05s; }
        .trust-badge:nth-child(2) { animation-delay: 0.15s; }
        .trust-badge:nth-child(3) { animation-delay: 0.25s; }
        .trust-badge:nth-child(4) { animation-delay: 0.35s; }
        .trust-badge:nth-child(1) .badge-icon { animation: iconBreathe 2.4s ease-in-out infinite; }
        .trust-badge:nth-child(2) .badge-icon { animation: iconShimmer 2.8s ease-in-out infinite; }
        .trust-badge:nth-child(3) .badge-icon { animation: iconBounce 2.6s ease-in-out infinite; }
        .trust-badge:nth-child(4) .badge-icon { animation: iconBreathe 3.2s ease-in-out infinite 0.6s; }
        .trust-badge:hover .badge-icon {
          animation: iconRotate 0.6s ease-in-out !important;
        }

        /* Premium footer links — understated, elegant hover */
        .footer-link {
          position: relative;
          color: #888;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: 'Varela Round', sans-serif;
          font-size: 13px;
          line-height: 1.6;
          transition: color 0.3s cubic-bezier(.2,.6,.2,1), letter-spacing 0.3s cubic-bezier(.2,.6,.2,1);
        }
        .footer-link:hover { color: #FF6B35; letter-spacing: 0.4px; }
        .footer-contact-link { color: inherit; text-decoration: none; transition: color 0.25s ease; }
        .footer-contact-link:hover { color: #FF6B35; }
      `}</style>
      {!reduceMotion && <ParticlesBackground />}
      {!reduceMotion && <CursorGlow />}
      {(() => {
        // Staff bypass now requires the password gate (sessionStorage flag set
        // by MaintenancePage after VITE_STAFF_PASSWORD matches). A bare ?staff=1
        // no longer bypasses on its own — it only auto-opens the password field.
        const isStaffOverride = staffUnlocked;
        // Public pre-launch preview: while in maintenance, the public (not
        // unlocked staff, not admin) may still browse the BLOOM "Find Your Breed"
        // experience on /pets — the grid, dog/cat filter and breed stories —
        // but cannot purchase. There, every buy CTA becomes "Join the BLOOM
        // Family" (waitlist). Staff/admin get the full site unchanged.
        const publicPreview = MAINTENANCE_MODE && !isAdmin && !isStaffOverride;
        // Maintenance gate. 'policies' (legal/SEO) and 'pets' (public preview)
        // stay reachable; everything else shows the maintenance screen.
        if (publicPreview && page !== 'policies' && page !== 'pets' && page !== 'breed') {
          return <MaintenancePage lang={lang} setLang={setLang} setPage={setPage} onUnlock={() => setStaffUnlocked(true)} />;
        }
        return (
          <>
            {/* Skip-to-content — first focusable element; visually hidden until
                focused (see .skip-link CSS), jumps keyboard users straight to <main>. */}
            <a href="#main" className="skip-link">{lang === "he" ? "דלג לתוכן" : lang === "ru" ? "Перейти к содержимому" : "Skip to content"}</a>
            {/* Polite route announcer for screen readers on SPA navigation. */}
            <div aria-live="polite" role="status" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>{routeAnnounce}</div>
            <AccessibilityMenu lang={lang} cartOpen={cartOpen} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} />
            <WhatsAppFab lang={lang} />
            <header>
              <Nav page={page} setPage={setPage} goToBlog={goToBlog} lang={lang} setLang={setLang} user={user} isAdmin={isAdmin} onLogout={handleLogout} cartCount={cart.reduce((s, it) => s + (it.qty || 1), 0)} onCartClick={openCart} preview={publicPreview} />
            </header>
            <main id="main" ref={mainRef} tabIndex={-1} style={{ outline: "none" }}>
            {page === "home" && <><HomeFloatingBloomCarousel lang={lang} setPage={setPage} /><Hero setPage={setPage} lang={lang} /><EventOrdersSection lang={lang} /><Reviews lang={lang} /></>}
            {page === "about" && <AboutPage lang={lang} setPage={setPage} />}
            {page === "pets" && <PetsPage lang={lang} setPage={setPage} goToBlog={goToBlog} goToBreed={goToBreed} preview={publicPreview} onOrderBloom={addBloomToCart} onAddStickerPack={addStickerPackToCart} onShareToast={showToast} />}
            {page === "breed" && <BreedPage slug={breedSlug} lang={lang} setPage={setPage} goToBreed={goToBreed} goToBlog={goToBlog} preview={publicPreview} onOrderBloom={addBloomToCart} onShareToast={showToast} />}
            {page === "blog" && (blogSlug
              ? <BlogPost slug={blogSlug} lang={lang} goToBlog={goToBlog} setPage={setPage} onShareToast={showToast} />
              : <BlogIndex lang={lang} goToBlog={goToBlog} />)}
            {page === "order" && <OrderPage lang={lang} user={user} setPage={setPage} pendingBloomItem={pendingBloomItem} clearPendingBloomItem={() => setPendingBloomItem(null)} cart={cart} setCart={setCart} updateCartQty={updateCartQty} pendingCheckout={pendingCheckout} clearPendingCheckout={() => setPendingCheckout(false)} />}
            {page === "track" && <TrackPage lang={lang} user={user} clearCart={clearCart} />}
            {page === "auth" && <AuthPage lang={lang} onAuth={handleAuth} />}
            {page === "admin" && isAdmin && <AdminPage lang={lang} />}
            {page === "admin" && !isAdmin && <Hero setPage={setPage} lang={lang} />}
            {page === "faq" && <FaqPage lang={lang} />}
            {page === "policies" && <PoliciesPage lang={lang} />}
            {page === "reset-password" && <ResetPasswordPage lang={lang} setPage={setPage} />}
            {page === "not-found" && <NotFoundPage lang={lang} setPage={setPage} />}
            {MUG_STUDIO_ENABLED && page === "mug-studio" && (
              <Suspense fallback={
                <div style={{
                  minHeight: "100vh", background: COLORS.bg, color: COLORS.gray,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Varela Round',sans-serif", padding: "80px 20px",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 40, height: 40, margin: "0 auto 14px",
                      border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent,
                      borderRadius: "50%", animation: "mugSpin 0.9s linear infinite",
                    }} />
                    <div style={{ fontSize: 14 }}>
                      {lang === "he" ? "טוען את סטודיו הספלים..." : lang === "ru" ? "Загрузка студии кружек..." : "Loading mug studio..."}
                    </div>
                  </div>
                  <style>{`@keyframes mugSpin { to { transform: rotate(360deg); } }`}</style>
                </div>
              }>
                <MugStudio lang={lang} setPage={setPage} onAddToCart={addMugStudioToCart} />
              </Suspense>
            )}
            </main>
            <Footer lang={lang} setPage={setPage} />
            {/* Spacer so the fixed cookie banner floats over empty space below the
                footer instead of covering a page's bottom CTA (e.g. the breed-page
                "Add to cart"). Only present while the banner is shown; removed on
                consent. aria-hidden — purely a layout cushion. */}
            {showCookieBanner && cookieConsent === null && (
              <div aria-hidden="true" style={{ height: 200 }} />
            )}
            <CartDrawer lang={lang} open={cartOpen} cart={cart} setCart={setCart} updateCartQty={updateCartQty} onClose={closeCart} onCheckout={goToCheckout} />
            {/* "Added to cart" toast — 3s, bottom-sheet style on mobile,
                top-corner pill on desktop. Action button opens the cart drawer. */}
            {cartToast && <CartToast
              message={cartToast}
              lang={lang}
              onClose={() => { setCartToast(null); setCartToastAction(null); }}
              onViewCart={() => { setCartToast(null); setCartToastAction(null); openCart(); }}
              actionLabel={cartToastAction?.label}
              onAction={cartToastAction ? () => { setCartToast(null); setCartToastAction(null); cartToastAction.handler(); } : undefined}
            />}
            <style>{`
              @keyframes cartToastInDesktop { from { opacity: 0; transform: translateX(${lang === "he" ? "-100%" : "100%"}); } to { opacity: 1; transform: translateX(0); } }
              @keyframes cartToastInMobile { from { opacity: 0; transform: translateY(120%); } to { opacity: 1; transform: translateY(0); } }
              @keyframes cartBadgeBump { 0% { transform: scale(1); } 35% { transform: scale(1.45); } 100% { transform: scale(1); } }
              .cart-badge-bump { animation: cartBadgeBump 0.35s cubic-bezier(.2,.6,.2,1); }
            `}</style>
            {showCookieBanner && cookieConsent === null && (
              <CookieConsent
                lang={lang}
                onAccept={() => { localStorage.setItem("sxp_cookie_consent", "accepted"); setCookieConsent("accepted"); setShowCookieBanner(false); }}
                onReject={() => { localStorage.setItem("sxp_cookie_consent", "rejected"); setCookieConsent("rejected"); setShowCookieBanner(false); }}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}

// ============ PAW PRINTS BACKGROUND — floating paws for /pets ============
function PawPrintsBackground() {
  const canvasRef = useRef(null);

  // Phone = touch device with a NARROW screen. Mirrors the gate in
  // ParticlesBackground so the BLOOM page doesn't run two heavy canvases
  // on phones; tablets (touch, width >= 768) and desktop keep the paws.
  // Kept in state + a resize listener so rotating a phone (or resizing across
  // the 768 threshold) re-evaluates the gate instead of being frozen at mount.
  const computeIsPhone = () => typeof window !== "undefined" &&
    (window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches) &&
    window.innerWidth < 768;
  const [isPhone, setIsPhone] = useState(computeIsPhone);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsPhone(computeIsPhone());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (isPhone) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    // Mobile fps cap — keeps the BLOOM page light when paws + particles
    // run on the same screen. Desktop is unchanged.
    const isMobile = window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 768;
    const FRAME_MIN_MS = isMobile ? 33 : 0;
    let lastFrameMs = 0;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // Draw a single paw print at (x,y) with given size, rotation and alpha
    const drawPaw = (x, y, size, rot, alpha, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      // main pad
      ctx.beginPath();
      ctx.ellipse(0, size * 0.35, size * 0.5, size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // three toes on top + side toes
      const toes = [
        { tx: -size * 0.42, ty: -size * 0.25, r: size * 0.22 },
        { tx: 0,            ty: -size * 0.5,  r: size * 0.24 },
        { tx: size * 0.42,  ty: -size * 0.25, r: size * 0.22 },
      ];
      toes.forEach((toe) => {
        ctx.beginPath();
        ctx.ellipse(toe.tx, toe.ty, toe.r, toe.r * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const paws = Array.from({ length: 18 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 16 + 10,
      speed: Math.random() * 0.25 + 0.08,
      drift: (Math.random() - 0.5) * 0.2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.004,
      // Subtle visibility bump (was *0.06+0.03 → 0.03–0.09): a touch more
      // present, still soft. Same count/size/positions/timing — opacity only.
      alpha: Math.random() * 0.08 + 0.05,
      color: Math.random() > 0.5 ? "#FF6B35" : "#ff8c5a",
    }));

    const draw = (now) => {
      animId = requestAnimationFrame(draw);
      if (FRAME_MIN_MS > 0 && now - lastFrameMs < FRAME_MIN_MS) return;
      lastFrameMs = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paws.forEach((p) => {
        drawPaw(p.x, p.y, p.size, p.rot, p.alpha, p.color);
        p.y -= p.speed;
        p.x += p.drift;
        p.rot += p.rotSpeed;
        // recycle to bottom when it floats off the top
        if (p.y < -p.size * 2) {
          p.y = canvas.height + p.size * 2;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -p.size * 2) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size * 2) p.x = -p.size;
      });
      ctx.globalAlpha = 1;
    };
    animId = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [isPhone]);

  if (isPhone) return null;

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 0,
    }} />
  );
}

// ============ PETS PAGE — BLOOM Collection / Pet Couture ============
// ============ BLOOM FAMILY WAITLIST (pre-launch) ============
// While MAINTENANCE_MODE is true the public can browse the BLOOM collection +
// breed stories but cannot buy — every purchase CTA becomes "Join the BLOOM
// Family", which captures the visitor's email and which breed they were
// interested in (public.waitlist). Checkout/cart/account stay gated.
const WL = {
  he: { heroTitle:`70 כלבים וחתולים. אחד מהם שלכם.`, heroSub:`מצאו את הגזע שלכם והצטרפו למשפחת BLOOM — גישה מוקדמת לפני כולם.`, joinBtn:`הצטרפו למשפחת BLOOM`, breedCta:(n)=>`רוצים את ${n} על חולצה או ספל? הצטרפו למשפחת BLOOM`, ph:`האימייל שלך`, submit:`אני בפנים`, submitting:`רגע...`, consent:`בהרשמה אני מאשר/ת לקבל עדכוני השקה מספלים שופ. ניתן להסיר בכל עת.`, success:`אתם במשפחת BLOOM. נעדכן אתכם כשהדלתות ייפתחו — עם גישה מוקדמת.`, already:`אתם כבר במשפחת BLOOM. נתראה כשהדלתות ייפתחו.`, error:`משהו השתבש. נסו שוב בעוד רגע.`, invalid:`כתובת אימייל לא תקינה.` },
  en: { heroTitle:`70 dogs & cats. One of them is yours.`, heroSub:`Find your breed and join the BLOOM Family — early access before everyone else.`, joinBtn:`Join the BLOOM Family`, breedCta:(n)=>`Want ${n} on a tee or mug? Join the BLOOM Family`, ph:`Your email`, submit:`I'm in`, submitting:`One sec...`, consent:`By joining I agree to receive launch updates from Sfalim Shop. Unsubscribe anytime.`, success:`You're in the BLOOM Family. We'll let you know when the doors open — with early access.`, already:`You're already in the BLOOM Family. See you when the doors open.`, error:`Something went wrong. Please try again.`, invalid:`Please enter a valid email.` },
  ru: { heroTitle:`70 собак и кошек. Одна из них — ваша.`, heroSub:`Найдите свою породу и вступите в семью BLOOM — ранний доступ раньше всех.`, joinBtn:`В семью BLOOM`, breedCta:(n)=>`Хотите ${n} на футболке или кружке? Вступайте в семью BLOOM`, ph:`Ваш email`, submit:`Я с вами`, submitting:`Секунду...`, consent:`Регистрируясь, я соглашаюсь получать новости о запуске от Sfalim Shop. Отписаться можно в любой момент.`, success:`Вы в семье BLOOM. Сообщим, когда откроются двери — с ранним доступом.`, already:`Вы уже в семье BLOOM. До встречи, когда откроются двери.`, error:`Что-то пошло не так. Попробуйте ещё раз.`, invalid:`Введите корректный email.` },
};

// Email-capture form. Self-contained: validates client-side, inserts into the
// waitlist (RLS allows anon INSERT with consent=true), and swaps itself for a
// success/already message. Reused by the hero (general signup) and each breed
// (breed_interest = slug). NOTE: no .select() chain — RLS only allows INSERT.
function WaitlistForm({ lang, source, breedInterest = null, autoFocus = false }) {
  const w = WL[lang] || WL.he;
  const isRTL = lang === `he`;
  const [email, setEmail] = useState(``);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // invalid | error | success | already
  const inputId = `wl-email-${source}-${breedInterest || `general`}`;
  const done = status === `success` || status === `already`;

  const submit = async (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setStatus(`invalid`); return; }
    setBusy(true); setStatus(null);
    try {
      const { error } = await supabase.from(`waitlist`).insert({ email: addr, lang, source, consent: true, breed_interest: breedInterest });
      if (!error) setStatus(`success`);
      else if (error.code === `23505`) setStatus(`already`); // duplicate => already in
      else setStatus(`error`);
    } catch (err) {
      console.error(`Waitlist insert failed:`, err);
      setStatus(`error`);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div role="status" aria-live="polite" style={{ background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.4)`, borderRadius: 12, padding: `18px 20px`, color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 15, lineHeight: 1.5, textAlign: isRTL ? `right` : `left` }}>
        {status === `already` ? w.already : w.success}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ width: `100%` }}>
      <label htmlFor={inputId} style={{ display: `block`, color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, marginBottom: 8, textAlign: isRTL ? `right` : `left` }}>
        {w.ph}
      </label>
      <div style={{ display: `flex`, flexDirection: isRTL ? `row-reverse` : `row`, gap: 10, flexWrap: `wrap` }}>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder={w.ph}
          disabled={busy}
          dir="ltr"
          style={{ flex: `1 1 200px`, minWidth: 0, background: COLORS.bg, color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: `14px 16px`, fontSize: 15, fontFamily: `'Varela Round',sans-serif`, outline: `none`, textAlign: `left` }}
          onFocus={(ev) => { ev.target.style.borderColor = COLORS.accent; }}
          onBlur={(ev) => { ev.target.style.borderColor = COLORS.border; }}
        />
        <button type="submit" disabled={busy} style={{ flexShrink: 0, background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 10, padding: `14px 28px`, fontSize: 15, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: busy ? `wait` : `pointer`, opacity: busy ? 0.7 : 1, transition: `background 0.2s` }}
          onMouseOver={(ev) => { if (!busy) ev.currentTarget.style.background = COLORS.accentBtnHover; }}
          onMouseOut={(ev) => { ev.currentTarget.style.background = COLORS.accentBtn; }}>
          {busy ? w.submitting : w.submit}
        </button>
      </div>
      <div aria-live="polite" style={{ minHeight: 18, marginTop: 8, textAlign: isRTL ? `right` : `left` }}>
        {(status === `invalid` || status === `error`) && (
          <span style={{ color: `#ff7a6b`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13 }}>
            {status === `invalid` ? w.invalid : w.error}
          </span>
        )}
      </div>
      <div style={{ color: COLORS.grayLight, fontFamily: `'Varela Round',sans-serif`, fontSize: 11, lineHeight: 1.5, marginTop: 4, textAlign: isRTL ? `right` : `left` }}>
        {w.consent}
      </div>
    </form>
  );
}

// "Join the BLOOM Family" CTA. Shows the join button (and, for a breed, the
// breed-specific line); clicking it reveals the inline WaitlistForm with the
// right source/breed_interest. variant: `hero` (general) | `breed` (in modal).
function JoinBloomCTA({ lang, source, breedInterest = null, breedName = null, variant = `hero` }) {
  const w = WL[lang] || WL.he;
  const isRTL = lang === `he`;
  const [open, setOpen] = useState(false);
  const ctaText = variant === `breed` && breedName ? w.breedCta(breedName) : null;

  if (open) {
    return <WaitlistForm lang={lang} source={source} breedInterest={breedInterest} autoFocus />;
  }
  // Hero variant: dead-center the (auto-width) button under the centered
  // heading/subtitle, direction-agnostic so it's centered in he (RTL) and
  // en/ru (LTR). Breed variant keeps reading-side alignment for its CTA line
  // (its button is full-width, so centering is moot there).
  const isHero = variant !== `breed`;
  return (
    <div style={isHero ? { display: `flex`, flexDirection: `column`, alignItems: `center`, textAlign: `center` } : { textAlign: isRTL ? `right` : `left` }}>
      {ctaText && (
        <div style={{ color: COLORS.white, fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: 18, lineHeight: 1.35, marginBottom: 14 }}>
          {ctaText}
        </div>
      )}
      <button type="button" onClick={() => setOpen(true)} style={{ width: variant === `breed` ? `100%` : `auto`, background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 10, padding: `15px 32px`, fontSize: 15, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer`, boxShadow: `0 8px 28px rgba(255,107,53,0.35)`, transition: `background 0.2s, transform 0.2s` }}
        onMouseOver={(ev) => { ev.currentTarget.style.background = COLORS.accentBtnHover; ev.currentTarget.style.transform = `translateY(-2px)`; }}
        onMouseOut={(ev) => { ev.currentTarget.style.background = COLORS.accentBtn; ev.currentTarget.style.transform = `translateY(0)`; }}>
        {w.joinBtn}
      </button>
    </div>
  );
}

function PetsPage({ lang, setPage, goToBlog, goToBreed, preview = false, onOrderBloom, onAddStickerPack, onShareToast }) {
  const isRTL = lang === "he";
  const w = WL[lang] || WL.he; // BLOOM Family waitlist copy (pre-launch preview)
  const [blogPosts, setBlogPosts] = useState([]); // latest 3 published — drives the "from our blog" stripe
  const quizT = LANGS[lang].quiz; // quiz banner copy lives in LANGS (single source)
  const [designs, setDesigns] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null); // currently opened character in modal
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  // Browse filters. species: `all`|`dog`|`cat`. query: substring matched
  // case-insensitively against names + breed_he/en/ru + breed_aliases.
  // Legacy rows (species IS NULL) only show under the All tab.
  const [speciesFilter, setSpeciesFilter] = useState(`all`);
  const [breedQuery, setBreedQuery] = useState(``);
  const [favOnly, setFavOnly] = useState(false); // "show favorites only" gallery filter
  const { favorites } = useFavorites();
  const pHero = useParallax(0.18);
  const pOrb1 = useParallax(0.4);
  const pOrb2 = useParallax(-0.3);
  const pTitle = useParallax(0.35);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Fetch the collection + sticker packs in parallel. A pack fetch failure
  // doesn't block the grid — packs are an add-on offering, not the main UI.
  useEffect(() => {
    (async () => {
      setLoadError(false); setLoading(true);
      try {
        const [designsRes, packsRes] = await Promise.all([
          supabase
            .from("pet_designs")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("sticker_packs")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        ]);
        if (designsRes.error) throw designsRes.error;
        setDesigns(designsRes.data || []);
        if (packsRes.error) {
          console.error("Failed to load BLOOM sticker packs:", packsRes.error);
        } else {
          setPacks(packsRes.data || []);
        }
      } catch (err) {
        console.error("Failed to load BLOOM collection:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  // Latest published blog posts for the "from our blog" stripe (Slice 3). Only
  // shown when there are 3+; a fetch failure or <3 simply hides it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("slug,title_he,title_en,title_ru,excerpt_he,excerpt_en,excerpt_ru,cover_image_url,cover_image_alt_he,category,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3);
      if (!cancelled && !error && data) setBlogPosts(data);
    })();
    return () => { cancelled = true; };
  }, []);

  // ============ SCHEMA.ORG — Product structured data for BLOOM (SEO / Rich Results) ============
  useEffect(() => {
    if (typeof document === "undefined" || !designs.length) return;

    const pickName = (d) => d[`name_${lang}`] || d.name_en || d.name_he || "BLOOM Character";
    const pickDesc = (d) => {
      const a = d[`animal_${lang}`] || d.animal_en || "";
      const tag = d[`tagline_${lang}`] || d.tagline_en || "";
      return [tag, a].filter(Boolean).join(" · ") || "BLOOM Collection pet portrait";
    };

    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "BLOOM Collection",
      "itemListElement": designs.map((d, i) => {
        // Contract pricing: BLOOM products are mug / shirt basic / shirt
        // oversized / sticker pack. Legacy price_shirt / price_sticker are
        // intentionally excluded so the lowPrice/highPrice that Google
        // surfaces matches what the catalog actually charges today.
        const prices = [d.price_sticker_pack, d.price_mug, d.price_shirt_basic, d.price_shirt_oversized]
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);
        const product = {
          "@type": "Product",
          "name": pickName(d),
          "description": pickDesc(d),
          "brand": { "@type": "Brand", "name": "Sfalim Shop" },
        };
        const image = d.mockup_url || d.design_url;
        if (image) product.image = image;
        if (prices.length) {
          product.offers = {
            "@type": "AggregateOffer",
            "priceCurrency": "ILS",
            "lowPrice": Math.min(...prices),
            "highPrice": Math.max(...prices),
            "availability": "https://schema.org/InStock",
          };
        }
        return { "@type": "ListItem", "position": i + 1, "item": product };
      }),
    };

    const stale = document.getElementById("bloom-jsonld");
    if (stale) stale.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "bloom-jsonld";
    script.text = JSON.stringify(itemList);
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById("bloom-jsonld");
      if (el) el.remove();
    };
  }, [designs, lang]);

  // Per-character document.title for deep-linked tabs/bookmarks. Restored on
  // cleanup so closing the modal returns the title to whatever the global
  // page-title effect set for /pets. We don't touch OG meta tags client-side:
  // social crawlers read those before the SPA renders, so client-side updates
  // wouldn't affect share previews — that needs SSR/prerender to actually work.
  useEffect(() => {
    if (typeof document === `undefined` || !selected) return;
    const charName = selected[`name_${lang}`] || selected.name_en || selected.name_he || ``;
    if (!charName) return;
    const prev = document.title;
    document.title = `${charName} · BLOOM · Sfalim Shop`;
    return () => { document.title = prev; };
  }, [selected, lang]);

  // URL-shareable BLOOM characters: #pets/<slug> opens that character.
  // pet_designs.slug is the SINGLE source of truth — the name_en-derived
  // fallback only kicks in if a row is somehow missing one. All current rows
  // have a slug, so this is essentially never used. Note: d.slug and
  // d.name_en are NOT always the same string — e.g. name_en="Luna" has
  // slug="rex", name_en="Milo" has slug="pearl". Resolving by name_en would
  // give the wrong URL for those characters.
  const slugify = (d) => {
    if (d?.slug) return d.slug;
    const name = (d?.name_en || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return name || (d?.id != null ? String(d.id) : "");
  };

  // Read the URL hash and open the matching character — or fall back to the grid view.
  useEffect(() => {
    if (!designs.length) return;
    const applyHash = () => {
      // Tolerate a leading slash ("#/pets..." as well as "#pets...") so deep
      // links from the blog / other tabs resolve the same as in-app navigation.
      const hash = rawHash().replace("#", "").replace(/^\//, "");
      const path = hash.split("?")[0];
      const parts = path.split("/");
      if (parts[0] !== "pets") return;
      // The breed slug can arrive two ways:
      //   • query param  →  #/pets?slug=01_golden_retriever   (blog deep links)
      //   • path segment →  #pets/01_golden_retriever         (in-app card click)
      // GOTCHA: with a hash router the "?slug=" lives INSIDE location.hash, never
      // in location.search — so it must be parsed out of the hash string here.
      let slug = "";
      const qIdx = hash.indexOf("?");
      if (qIdx !== -1) slug = new URLSearchParams(hash.slice(qIdx + 1)).get("slug") || "";
      // "Show favorites only" deep link from the nav heart (#/pets?fav=1).
      if (qIdx !== -1 && new URLSearchParams(hash.slice(qIdx + 1)).get("fav") === "1") setFavOnly(true);
      if (!slug) slug = parts[1] || "";
      if (!slug) { setSelected(null); return; }
      const match = designs.find(d => slugify(d) === slug);
      if (match) {
        setSelected(match);
      } else {
        // Unknown slug — fall back gracefully to the collection view and tidy the URL
        setSelected(null);
        window.history.replaceState({ page: "pets" }, "", "#pets");
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [designs]);

  const openPet = (d) => {
    setSelected(d);
    const slug = slugify(d);
    if (slug) window.history.pushState({ page: "pets" }, "", `#pets/${slug}`);
  };

  const closePet = () => {
    setSelected(null);
    // replaceState (not pushState) so the back button returns to the page
    // the user was on before opening the modal, not back into the modal.
    window.history.replaceState({ page: "pets" }, "", "#pets");
  };

  // Derived browse list for the GRID. Browsing breeds happens in the grid only —
  // the modal no longer walks this list (it shows one breed and flips that breed's
  // views via the shared <BloomImageCarousel>). To see another breed the user
  // closes the modal and taps another card.
  const filtered = React.useMemo(() => {
    let list = designs;
    if (favOnly) list = list.filter(d => favorites.includes(slugify(d)));
    if (speciesFilter !== `all`) list = list.filter(d => d.species === speciesFilter);
    const q = breedQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(d => {
        const hay = [
          d.name_he, d.name_en, d.name_ru,
          d.breed_he, d.breed_en, d.breed_ru,
          d.breed_aliases,
        ].filter(Boolean).join(` `).toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [designs, speciesFilter, breedQuery, favOnly, favorites]);

  // Translations
  const t = {
    he: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "אוסף מובחר. דמויות עם נשמה.",
      subheading2: (n) => `${n} דיוקנאות בשמן — לכל אחד אופי משלו.`,
      scroll: "גלה את האוסף",
      collectionEyebrow: "האוסף",
      collectionCount: (n) => `${n} דמויות`,
      loading: "טוען אוסף...",
      empty: "האוסף בקרוב",
      priceFrom: "החל מ-₪",
      shirtLabel: "חולצה",
      mugLabel: "ספל",
      stickerLabel: "מדבקה",
      availableOn: "זמין עבור",
      detailMore: "פרטים",
      modalClose: "סגירה",
      orderBtn: "הזמנה כ",
      comingSoonTitle: "ייצור BLOOM יוצא לדרך",
      comingSoonSub: "מערכת התשלום של אוסף BLOOM נמצאת בשלבי שלמות סופיים. תקבל הודעה במייל כשנהיה מוכנים.",
      gotIt: "הבנתי",
      ctaTitle: "רוצה משהו אחר?",
      ctaSub: "צור עיצוב משלך ונדפיס אותו על מה שתבחר",
      ctaBtn: "הזמנת הדפסה מותאמת ←",
      shareBtn: "שתפו",
      shareCopied: "הקישור הועתק!",
      shareWhatsApp: "שתפו בוואטסאפ",
      tabAll: "הכל",
      tabDogs: "כלבים",
      tabCats: "חתולים",
      searchPlaceholder: "חיפוש לפי גזע (לדוגמה: קורגי, פיטבול)",
      noResults: "לא נמצאו דמויות שתואמות לחיפוש שלך",
      clearFilters: "נקה סינון",
      favTab: "מועדפים",
      favEmpty: "עדיין אין מועדפים — הקישו על הלב על דמויות שאהבתם 🤍",
      packsEyebrow: "חבילות מדבקות",
      packsHeading: "10 מדבקות באריזה אחת",
      packAddToCart: "הוסף לסל",
      madeToOrder: "נוצר בהזמנה",
      dispatchTime: "זמן ייצור 3-5 ימי עסקים",
      petNameTitle: "התאמה אישית",
      petNameLabel: "שם חיית המחמד (אופציונלי)",
      petNamePlaceholder: "למשל: רקסי",
      petNameHelper: "גודל ההדפסה מותאם למוצר — לבקשות מיוחדות כתבו בהערות.",
      petNameFontLabel: "גופן",
      petNameColorLabel: "צבע",
    },
    en: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "A curated collection. Characters with soul.",
      subheading2: (n) => `${n} oil portraits, each one with its own personality.`,
      scroll: "Browse the collection",
      collectionEyebrow: "THE COLLECTION",
      collectionCount: (n) => `${n} CHARACTERS`,
      loading: "Loading collection...",
      empty: "Collection coming soon",
      priceFrom: "From ₪",
      shirtLabel: "T-shirt",
      mugLabel: "Mug",
      stickerLabel: "Sticker",
      availableOn: "Available on",
      detailMore: "View details",
      modalClose: "Close",
      orderBtn: "Order as",
      comingSoonTitle: "BLOOM Checkout Launching Soon",
      comingSoonSub: "Direct ordering of BLOOM characters is in final integration. We will notify you by email when ready.",
      gotIt: "Got it",
      ctaTitle: "Want something different?",
      ctaSub: "Create your own design and we'll print it on anything",
      ctaBtn: "Custom prints →",
      shareBtn: "Share",
      shareCopied: "Link copied!",
      shareWhatsApp: "Share on WhatsApp",
      tabAll: "All",
      tabDogs: "Dogs",
      tabCats: "Cats",
      searchPlaceholder: "Search by breed (e.g. corgi, pitbull)",
      noResults: "No characters match your search",
      clearFilters: "Clear filters",
      favTab: "Favorites",
      favEmpty: "No favorites yet — tap the heart on designs you love 🤍",
      packsEyebrow: "Sticker packs",
      packsHeading: "10 stickers per pack",
      packAddToCart: "Add to cart",
      madeToOrder: "Made to order",
      dispatchTime: "Production 3-5 business days",
      petNameTitle: "Personalization",
      petNameLabel: "Pet name (optional)",
      petNamePlaceholder: "e.g. Rex",
      petNameHelper: "Print size is matched to the product — for special requests, add a note at checkout.",
      petNameFontLabel: "Font",
      petNameColorLabel: "Color",
    },
    ru: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "Кураторская коллекция. Персонажи с душой.",
      subheading2: (n) => `${n} масляных портретов, каждый со своим характером.`,
      scroll: "Просмотреть коллекцию",
      collectionEyebrow: "КОЛЛЕКЦИЯ",
      collectionCount: (n) => `${n} ПЕРСОНАЖЕЙ`,
      loading: "Загрузка коллекции...",
      empty: "Коллекция скоро появится",
      priceFrom: "От ₪",
      shirtLabel: "Футболка",
      mugLabel: "Кружка",
      stickerLabel: "Стикер",
      availableOn: "Доступно на",
      detailMore: "Подробнее",
      modalClose: "Закрыть",
      orderBtn: "Заказать как",
      comingSoonTitle: "Оформление BLOOM скоро запустится",
      comingSoonSub: "Прямой заказ персонажей BLOOM проходит финальную интеграцию. Мы уведомим вас по email когда будет готово.",
      gotIt: "Понятно",
      ctaTitle: "Хочешь что-то другое?",
      ctaSub: "Создай свой дизайн, и мы напечатаем его на чём угодно",
      ctaBtn: "Печать на заказ →",
      shareBtn: "Поделиться",
      shareCopied: "Ссылка скопирована!",
      shareWhatsApp: "Поделиться в WhatsApp",
      tabAll: "Все",
      tabDogs: "Собаки",
      tabCats: "Кошки",
      searchPlaceholder: "Поиск по породе (напр. корги, питбуль)",
      noResults: "По вашему запросу ничего не найдено",
      clearFilters: "Сбросить фильтры",
      favTab: "Избранное",
      favEmpty: "Пока нет избранного — нажмите на сердечко у понравившихся дизайнов 🤍",
      packsEyebrow: "Наборы наклеек",
      packsHeading: "10 наклеек в наборе",
      packAddToCart: "В корзину",
      madeToOrder: "Сделано на заказ",
      dispatchTime: "Производство 3-5 рабочих дней",
      petNameTitle: "Персонализация",
      petNameLabel: "Имя питомца (необязательно)",
      petNamePlaceholder: "напр. Рекс",
      petNameHelper: "Размер печати подбирается под товар — для особых пожеланий оставьте примечание при оформлении.",
      petNameFontLabel: "Шрифт",
      petNameColorLabel: "Цвет",
    },
  }[lang] || {};

  const getDesignName = (d) => d[`name_${lang}`] || d.name_en;
  const getAnimal = (d) => d[`animal_${lang}`] || d.animal_en;
  const getTagline = (d) => d[`tagline_${lang}`] || d.tagline_en;

  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: "100vh", paddingTop: 72, direction: isRTL ? "rtl" : "ltr" }}>
      {/* Ambient orange glow background */}
      <div style={{ position: "fixed", top: "10%", left: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 60%)", filter: "blur(60px)", zIndex: 0, pointerEvents: "none", transform: `translateY(${pOrb1}px)`, willChange: "transform" }} />
      <div style={{ position: "fixed", bottom: "10%", right: "5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 60%)", filter: "blur(80px)", zIndex: 0, pointerEvents: "none", transform: `translateY(${pOrb2}px)`, willChange: "transform" }} />

      {/* Floating paw prints */}
      <PawPrintsBackground />

      {/* ===== HERO ===== */}
      <section style={{ position: "relative", zIndex: 1, padding: isMobile ? "60px 20px 40px" : "100px 40px 60px", textAlign: "center", maxWidth: 1200, margin: "0 auto", transform: `translateY(${pHero}px)`, willChange: "transform" }}>
        <div className="reveal" style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: isMobile ? 11 : 13, letterSpacing: "2px", marginBottom: 24 }}>
          {t.eyebrow}
        </div>

        <div style={{ transform: `translateY(${pTitle}px)`, willChange: "transform" }}>
        <h1 className="reveal" data-delay="1" style={{
          fontFamily: "'Playfair Display',serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: isMobile ? "5rem" : "9rem",
          lineHeight: 0.95,
          color: COLORS.white,
          margin: "0 0 20px 0",
          letterSpacing: "-0.02em",
          textShadow: "0 8px 30px rgba(255,107,53,0.15)",
        }} dir="ltr">
          {t.heading}
        </h1>
        </div>

        {/* Orange divider with dot */}
        <div className="reveal" data-delay="2" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "30px 0" }}>
          <div style={{ width: 60, height: 1, background: COLORS.accent }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, boxShadow: "0 0 12px rgba(255,107,53,0.6)" }} />
          <div style={{ width: 60, height: 1, background: COLORS.accent }} />
        </div>

        <p className="reveal" data-delay="3" style={{ color: COLORS.gray, fontSize: isMobile ? 15 : 18, fontFamily: "'Varela Round',sans-serif", maxWidth: 540, margin: "0 auto 8px", lineHeight: 1.5 }}>
          {t.subheading}
        </p>
        <p className="reveal" data-delay="4" style={{ color: "#8a8a8a", fontSize: isMobile ? 13 : 15, fontFamily: "'Playfair Display',serif", fontStyle: "italic", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.5 }}>
          {t.subheading2 ? t.subheading2(designs.length) : ``}
        </p>
      </section>

      {/* ===== JOIN THE BLOOM FAMILY (pre-launch public preview only) ===== */}
      {preview && (
        <section style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: isMobile ? "0 20px 24px" : "0 40px 32px" }}>
          <div style={{ background: `linear-gradient(135deg, ${COLORS.accentDim}, rgba(255,107,53,0.04))`, border: `1px solid rgba(255,107,53,0.35)`, borderRadius: 18, padding: isMobile ? "28px 22px" : "40px 44px", textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: isMobile ? "1.6rem" : "2.2rem", color: COLORS.white, margin: "0 0 12px", lineHeight: 1.2 }}>{w.heroTitle}</h2>
            <p style={{ color: COLORS.gray, fontFamily: "'Varela Round',sans-serif", fontSize: isMobile ? 14 : 16, lineHeight: 1.5, maxWidth: 560, margin: "0 auto 24px" }}>{w.heroSub}</p>
            <div style={{ maxWidth: 460, margin: "0 auto" }}>
              <JoinBloomCTA lang={lang} source="bloom" variant="hero" />
            </div>
          </div>
        </section>
      )}

      {/* ===== BLOOM QUIZ BANNER (links to the static /quiz page) ===== */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: isMobile ? "0 16px 8px" : "0 40px" }}>
        <a href="/quiz" style={{ textDecoration: "none", display: "block" }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", justifyContent: "space-between", gap: isMobile ? 14 : 24, background: `linear-gradient(135deg, ${COLORS.accentDim}, rgba(255,107,53,0.04))`, border: `1px solid rgba(255,107,53,0.35)`, borderRadius: 16, padding: isMobile ? "20px 22px" : "22px 32px", direction: LANGS[lang].dir, textAlign: isMobile ? "center" : "start", transition: "box-shadow 0.2s, border-color 0.2s" }}
            onMouseOver={e => { e.currentTarget.style.boxShadow = "0 12px 30px rgba(255,107,53,0.18)"; e.currentTarget.style.borderColor = COLORS.accent; }}
            onMouseOut={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "rgba(255,107,53,0.35)"; }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? 20 : 24, marginBottom: 6 }}>{quizT.banner_title}</div>
              <div style={{ color: COLORS.gray, fontFamily: "'Varela Round',sans-serif", fontSize: isMobile ? 13 : 15, lineHeight: 1.5 }}>{quizT.banner_sub}</div>
            </div>
            <span style={{ flexShrink: 0, background: COLORS.accentBtn, color: "#fff", borderRadius: 999, padding: "12px 24px", fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>{quizT.banner_cta}</span>
          </div>
        </a>
      </section>

      {/* ===== FROM OUR BLOG stripe (Slice 3) — only when 3+ published posts ===== */}
      {blogPosts.length >= 3 && (
        <section style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: isMobile ? "16px 16px 0" : "24px 40px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.4rem" : "1.9rem", color: COLORS.white, margin: 0 }}>{(LANGS[lang] || LANGS.he).blogHeroTitle}</h2>
            <button onClick={() => goToBlog && goToBlog()} style={{ background: "transparent", border: "none", color: COLORS.accent, fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{(LANGS[lang] || LANGS.he).blogFromOurBlog}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 16 : 20 }}>
            {blogPosts.map((p) => <BlogCard key={p.slug} post={p} lang={lang} goToBlog={goToBlog} compact />)}
          </div>
        </section>
      )}

      {/* ===== COLLECTION GRID ===== */}
      <section style={{ position: "relative", zIndex: 1, padding: isMobile ? "20px 16px 80px" : "40px 40px 120px", maxWidth: 1400, margin: "0 auto" }}>
        <div className="reveal" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "2px", marginBottom: 8 }}>
              {t.collectionEyebrow}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.5rem" : "2rem", color: COLORS.white, margin: 0 }}>
              {t.collectionCount ? t.collectionCount(filtered.length) : ``}
            </h2>
          </div>
        </div>

        {/* Browse filters: dog/cat tabs + breed search. Hidden while loading
            or when the collection is empty (no point showing filters over
            zero results from a fetch failure). The tabs always show the
            three options — counts beside them so the user knows what to
            expect before clicking. */}
        {!loading && designs.length > 0 && (
          <div style={{ display: "flex", flexDirection: isMobile ? `column` : `row`, alignItems: isMobile ? `stretch` : `center`, gap: 12, marginBottom: 32, flexWrap: "wrap", position: `sticky`, top: 72, zIndex: 40, background: `rgba(15,15,15,0.92)`, backdropFilter: `blur(12px)`, WebkitBackdropFilter: `blur(12px)`, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
            <div role="tablist" aria-label={t.collectionEyebrow} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { id: `all`, emoji: `🐾`, label: t.tabAll, count: designs.length },
                { id: `dog`, emoji: `🐶`, label: t.tabDogs, count: designs.filter(d => d.species === `dog`).length },
                { id: `cat`, emoji: `🐱`, label: t.tabCats, count: designs.filter(d => d.species === `cat`).length },
              ].map(tab => {
                const active = speciesFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSpeciesFilter(tab.id)}
                    style={{
                      background: active ? COLORS.accent : `transparent`,
                      color: active ? `#fff` : COLORS.gray,
                      border: `${active ? 2 : 1}px solid ${active ? COLORS.accent : COLORS.border}`,
                      borderRadius: 999,
                      padding: `12px 22px`,
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: `'Varela Round',sans-serif`,
                      cursor: `pointer`,
                      transition: `background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s`,
                      transform: active ? `scale(1.05)` : `scale(1)`,
                      display: `inline-flex`,
                      alignItems: `center`,
                      gap: 6,
                    }}>
                    <span style={{ fontSize: 18 }} aria-hidden="true">{tab.emoji}</span>
                    <span>{tab.label}</span>
                    <span style={{ opacity: 0.7, marginInlineStart: 2 }}>{tab.count}</span>
                  </button>
                );
              })}
              {/* Favorites-only toggle — sits with the species tabs */}
              <button
                type="button"
                aria-pressed={favOnly}
                onClick={() => setFavOnly(v => !v)}
                title={t.favTab}
                style={{
                  background: favOnly ? COLORS.accent : `transparent`,
                  color: favOnly ? `#fff` : COLORS.gray,
                  border: `${favOnly ? 2 : 1}px solid ${favOnly ? COLORS.accent : COLORS.border}`,
                  borderRadius: 999, padding: `12px 20px`, fontSize: 15, fontWeight: 700,
                  fontFamily: `'Varela Round',sans-serif`, cursor: `pointer`,
                  display: `inline-flex`, alignItems: `center`, gap: 6,
                  transition: `background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s`,
                  transform: favOnly ? `scale(1.05)` : `scale(1)`,
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill={favOnly ? `currentColor` : `none`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span>{t.favTab}</span>
                <span style={{ opacity: 0.7, marginInlineStart: 2 }}>{favorites.length}</span>
              </button>
            </div>
            <div style={{ flex: 1, minWidth: isMobile ? `auto` : 240, position: `relative` }}>
              <input
                type="search"
                value={breedQuery}
                onChange={(e) => setBreedQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                style={{
                  width: `100%`,
                  background: COLORS.bgCard,
                  color: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: `10px 14px`,
                  fontSize: 14,
                  fontFamily: `'Varela Round',sans-serif`,
                  outline: `none`,
                  boxSizing: `border-box`,
                  direction: isRTL ? `rtl` : `ltr`,
                }}
                onFocus={e => { e.target.style.borderColor = COLORS.accent; }}
                onBlur={e => { e.target.style.borderColor = COLORS.border; }}
              />
            </div>
            {(speciesFilter !== `all` || breedQuery || favOnly) && (
              <button
                type="button"
                onClick={() => { setSpeciesFilter(`all`); setBreedQuery(``); setFavOnly(false); }}
                style={{ background: `transparent`, color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `8px 14px`, fontSize: 12, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer` }}>
                {t.clearFilters}
              </button>
            )}
          </div>
        )}

        {loadError && (
          <LoadError lang={lang} onRetry={() => setReloadKey((k) => k + 1)} />
        )}

        {loading && !loadError && (
          <div style={{ textAlign: "center", padding: 80, color: COLORS.gray, fontFamily: "'Varela Round',sans-serif" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", animation: "petsSpin 0.8s linear infinite", marginBottom: 16 }} />
            <div>{t.loading}</div>
          </div>
        )}

        {!loading && !loadError && designs.length === 0 && (
          <div style={{ textAlign: "center", padding: 80, color: COLORS.gray, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 20 }}>
            {t.empty}
          </div>
        )}

        {!loading && designs.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 80, color: COLORS.gray, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 18 }}>
            {favOnly ? t.favEmpty : t.noResults}
          </div>
        )}

        {/* Sticker packs — featured bundles, shown above the grid once data
            loads. Each pack adds a single sticker_pack line to the cart at
            its bundled price. Single-character stickers are NOT sold here
            (free gift only). */}
        {!preview && !loading && packs.length > 0 && typeof onAddStickerPack === `function` && (
          <div className="reveal" style={{ marginBottom: 40 }}>
            <div style={{ color: COLORS.accent, fontFamily: `'IBM Plex Mono','Courier New',monospace`, fontSize: 11, letterSpacing: `2px`, marginBottom: 8 }}>
              {t.packsEyebrow}
            </div>
            <h3 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: isMobile ? `1.4rem` : `1.8rem`, color: COLORS.white, margin: `0 0 16px 0` }}>
              {t.packsHeading}
            </h3>
            <div style={{ display: `grid`, gridTemplateColumns: isMobile ? `1fr` : `repeat(auto-fit, minmax(280px, 1fr))`, gap: isMobile ? 12 : 20 }}>
              {packs.map((pack) => {
                const packName = pack[`name_${lang}`] || pack.name_he || pack.name_en;
                return (
                  <div key={pack.id} style={{
                    background: COLORS.bgCard,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 14,
                    overflow: `hidden`,
                    display: `flex`,
                    flexDirection: isMobile ? `row` : `column`,
                    transition: `border-color 0.2s, transform 0.18s cubic-bezier(.2,.6,.2,1)`,
                  }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = `translateY(-4px)`; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = `translateY(0)`; }}>
                    <div style={{ width: isMobile ? 120 : `100%`, aspectRatio: isMobile ? `1` : `4/3`, background: `#0d0d0d`, display: `flex`, alignItems: `center`, justifyContent: `center`, flexShrink: 0 }}>
                      <SmartImage src={pack.image_url} alt={packName} loading="lazy" style={{ width: `100%`, height: `100%`, objectFit: `contain`, padding: 8 }} />
                    </div>
                    <div style={{ padding: isMobile ? `12px 14px` : 18, display: `flex`, flexDirection: `column`, gap: 8, flex: 1 }}>
                      <h4 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: isMobile ? 17 : 20, color: COLORS.white, margin: 0 }}>{packName}</h4>
                      <div style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 12 }}>
                        {`${(pack.item_slugs || []).length} ${lang === `he` ? `מדבקות` : lang === `ru` ? `наклеек` : `stickers`}`}
                      </div>
                      <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, marginTop: `auto`, gap: 10 }}>
                        <span style={{ color: COLORS.accent, fontFamily: `'Playfair Display',serif`, fontWeight: 700, fontSize: 18 }}>{`₪${pack.price}`}</span>
                        <button
                          type="button"
                          onClick={() => onAddStickerPack(pack)}
                          style={{
                            background: COLORS.accentBtn,
                            color: `#fff`,
                            border: `none`,
                            borderRadius: 8,
                            padding: `8px 16px`,
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: `'Varela Round',sans-serif`,
                            cursor: `pointer`,
                            transition: `background 0.2s`,
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtnHover; }}
                          onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; }}>
                          {t.packAddToCart}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: isMobile ? 12 : 24,
          }}>
            {filtered.map((d, i) => (
              <div key={d.id} className="reveal" data-delay={String((i % 6) + 1)}>
                <PetCard
                  design={d}
                  lang={lang}
                  index={i}
                  name={getDesignName(d)}
                  animal={getAnimal(d)}
                  tagline={getTagline(d)}
                  priceFrom={t.priceFrom}
                  preview={preview}
                  onClick={() => openPet(d)}
                  isMobile={isMobile}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== CTA SECTION ===== */}
      {/* Pre-launch: the order CTA is replaced by a closing "Join the BLOOM
          Family" band so the public never hits a buy action. */}
      <section className="reveal" style={{ position: "relative", zIndex: 1, padding: isMobile ? "60px 20px" : "80px 40px", textAlign: "center", borderTop: `1px solid ${COLORS.border}`, maxWidth: 900, margin: "0 auto" }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.8rem" : "2.4rem", color: COLORS.white, margin: "0 0 12px 0" }}>
          {t.ctaTitle}
        </h3>
        <p style={{ color: COLORS.gray, fontSize: isMobile ? 14 : 16, fontFamily: "'Varela Round',sans-serif", marginBottom: 30 }}>
          {preview ? w.heroSub : t.ctaSub}
        </p>
        {preview ? (
          <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
            <JoinBloomCTA lang={lang} source="bloom" variant="hero" />
          </div>
        ) : (
        <button onClick={() => setPage("order")} style={{
          background: COLORS.accentBtn,
          border: "none",
          color: "#fff",
          padding: isMobile ? "14px 28px" : "16px 36px",
          borderRadius: 10,
          cursor: "pointer",
          fontFamily: "'Varela Round',sans-serif",
          fontSize: isMobile ? 14 : 15,
          fontWeight: 700,
          letterSpacing: "0.3px",
          boxShadow: "0 8px 28px rgba(255,107,53,0.35)",
          transition: "all 0.25s cubic-bezier(.2,.6,.2,1)",
        }}
        onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtnHover; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(255,107,53,0.5)"; }}
        onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,107,53,0.35)"; }}
        >{t.ctaBtn}</button>
        )}
      </section>

      {/* ===== DETAIL MODAL ===== */}
      {selected && (
        <PetModal
          design={selected}
          lang={lang}
          name={getDesignName(selected)}
          animal={getAnimal(selected)}
          tagline={getTagline(selected)}
          t={t}
          preview={preview}
          goToBlog={goToBlog}
          goToBreed={goToBreed}
          onClose={closePet}
          isMobile={isMobile}
          onOrderBloom={onOrderBloom}
          shareSlug={slugify(selected)}
          onShareToast={onShareToast}
        />
      )}

      {/* Animations for PetsPage */}
      <style>{`
        @keyframes petsSpin { to { transform: rotate(360deg); } }
        @keyframes petCardFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============ PET BADGES — Bestseller / New corner badges ============
// Sits in the top-leading corner (top-right in RTL, top-left in LTR). Shared
// between the gallery card and the detail modal so they stay visually identical.
function PetBadges({ design, lang }) {
  const isRTL = lang === "he";
  const labels = LANGS[lang].badges;
  const showBest = !!design?.is_bestseller;
  const showNew = !!design?.is_new;
  if (!showBest && !showNew) return null;
  return (
    <div style={{
      position: "absolute",
      top: 10,
      insetInlineStart: 10,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      zIndex: 3,
      pointerEvents: "none",
    }}>
      {showBest && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: COLORS.accentBtn,
          color: "#fff",
          fontFamily: "'Varela Round',sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 9px",
          borderRadius: 6,
          boxShadow: "0 4px 12px rgba(255,107,53,0.35)",
          whiteSpace: "nowrap",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {labels.bestseller}
        </span>
      )}
      {showNew && (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "rgba(15,15,15,0.85)",
          color: COLORS.accent,
          border: `1px solid ${COLORS.accent}`,
          fontFamily: "'Varela Round',sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 6,
          backdropFilter: "blur(4px)",
          whiteSpace: "nowrap",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 3l1.91 5.18L19 10l-5.09 1.82L12 17l-1.91-5.18L5 10l5.09-1.82L12 3z" />
          </svg>
          {labels.new}
        </span>
      )}
    </div>
  );
}

// ============ PET CARD — gallery tile ============
function PetCard({ design, lang, index, name, animal, tagline, priceFrom, preview = false, onClick, isMobile }) {
  const [hovered, setHovered] = useState(false);
  // Prefer the new product-mockup (breed on a shirt) — it shows the user the
  // actual product they'd be buying. Falls back to the clean hero image, then
  // the raw design transparent PNG if neither shipped for this row yet.
  // Grid thumbnail: serve a resized transform (~2× the ~300px card for retina).
  // The full-res original is used in PetModal's large preview (untouched).
  const imgSrc = transformImage(design.mockup_shirt_url || design.mockup_url || design.design_url, { width: 600 });
  const fallbackBg = design.mockup_bg || "#1a1a1a";

  // Editorial corner-cut on hover (desktop only — no hover on touch)
  const cutCard = hovered && !isMobile;
  const clipPath = cutCard
    ? "polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%)"
    : "polygon(0 0, 100% 0, 100% 100%, 100% 100%, 0 100%)";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={lang === "he" ? `פרטים על ${name}` : lang === "ru" ? `Подробнее: ${name}` : `View ${name}`}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onTouchEnd={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      onTouchCancel={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      style={{
        cursor: "pointer",
        background: "transparent",
        border: `1px solid ${hovered ? COLORS.accent : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14,
        overflow: "hidden",
        clipPath,
        transition: "clip-path 0.4s cubic-bezier(.2,.6,.2,1), transform 0.18s cubic-bezier(.2,.6,.2,1), box-shadow 0.35s cubic-bezier(.2,.6,.2,1), border-color 0.35s",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered ? "0 18px 48px rgba(0,0,0,0.4), 0 0 30px rgba(255,107,53,0.15)" : "none",
      }}>
      {/* Image area */}
      <div style={{
        position: "relative",
        aspectRatio: "1",
        background: design.mockup_url ? "transparent" : fallbackBg,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <SmartImage
          src={imgSrc}
          alt={name}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            padding: design.mockup_url ? "8%" : "14%",
            transition: "transform 0.6s cubic-bezier(.2,.6,.2,1)",
            transform: hovered ? "scale(1.05)" : "scale(1)",
          }}
        />
        {/* Hover overlay with orange tint */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: hovered ? "linear-gradient(180deg, transparent 50%, rgba(255,107,53,0.12) 100%)" : "transparent",
          transition: "all 0.4s",
          pointerEvents: "none",
        }} />
        <PetBadges design={design} lang={lang} />
        {/* Favorite heart — top corner; stops propagation so it never opens the card */}
        <div style={{ position: "absolute", top: 10, insetInlineEnd: 10, zIndex: 3 }}>
          <FavHeart slug={design.slug} name={name} lang={lang} size={isMobile ? 36 : 40} />
        </div>
      </div>

      {/* Text content */}
      <div style={{ padding: isMobile ? 14 : 20 }}>
        <h3 style={{
          fontFamily: "'Playfair Display',serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: isMobile ? 22 : 28,
          color: COLORS.white,
          margin: 0,
          letterSpacing: "-0.01em",
        }}>{name}</h3>
        <div style={{
          color: COLORS.gray,
          fontFamily: "'IBM Plex Mono','Courier New',monospace",
          fontSize: 10,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginTop: 4,
        }}>{animal}</div>
        <div style={{
          color: COLORS.accent,
          fontFamily: "'Playfair Display',serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: isMobile ? 13 : 15,
          marginTop: 8,
        }}>{tagline}</div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 14,
          paddingTop: 14,
          borderTop: `1px solid ${COLORS.border}`,
        }}>
          {/* Pre-launch: no price shown — the breed detail offers "Join the
              BLOOM Family" instead of a purchase. */}
          <span style={{ color: COLORS.gray, fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>{preview ? `` : `${priceFrom}${Number(design.price_mug) || Number(design.price_sticker) || 59}`}</span>
          <span style={{ color: hovered ? COLORS.accent : COLORS.white, fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 700, transition: "color 0.2s", letterSpacing: "0.3px" }}>{lang === "he" ? "←" : "→"}</span>
        </div>
      </div>
    </div>
  );
}

// ============ PET MODAL — character detail ============
function PetModal({ design, lang, name, animal, tagline, t, preview = false, goToBlog, goToBreed, onClose, isMobile, onOrderBloom, shareSlug, onShareToast }) {
  const isRTL = lang === "he";
  const [selectedColor, setSelectedColor] = useState(BLOOM_SHIRT_COLORS[0]);
  const [shirtType, setShirtType] = useState("basic");
  const [shirtSize, setShirtSize] = useState("m");
  const [zoomed, setZoomed] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null); // null | `mug` | `shirt`
  const [petName, setPetName] = useState(``); // optional personalization (free)
  const [petNameFont, setPetNameFont] = useState(PET_NAME_FONT_DEFAULT);
  const [petNameColor, setPetNameColor] = useState(PET_NAME_COLOR_DEFAULT);
  // Slice 3: if a published blog post links to this breed, surface a "read more
  // about the breed" link at the bottom of the modal.
  const [breedPost, setBreedPost] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setBreedPost(null);
    if (!design || !design.slug) return;
    (async () => {
      const { data } = await supabase
        .from(`blog_posts`).select(`slug,title_he,title_en,title_ru`)
        .eq(`breed_slug_link`, design.slug).eq(`status`, `published`)
        .order(`published_at`, { ascending: false }).limit(1).maybeSingle();
      if (!cancelled && data) setBreedPost(data);
    })();
    return () => { cancelled = true; };
  }, [design && design.slug]);
  // The image + view nav (arrows / counter / enlarge / swipe) live in the shared
  // <BloomImageCarousel> below — it computes imgSrc from previewProduct/selectedColor.

  // Share: build a Hebrew share line (Israel = WhatsApp-heavy) pointing at the
  // clean /p/<slug> URL — the serverless function at api/p/[handle].js serves
  // per-product OG meta on that path for crawlers (WhatsApp/Facebook/etc.) and
  // 302-redirects real browsers to /#pets/<slug> so the modal opens. The slug
  // is the SAME derivation as the hash router's openPet (slugify(d) in
  // PetsPage) so the link round-trips into the exact character.
  const heName = design?.name_he || design?.name_en || name;
  const shareUrl = shareSlug ? `https://www.sfalimshop.com/p/${shareSlug}` : `https://www.sfalimshop.com/`;
  const shareText = `תראו את "${heName}" 🐾 מבית BLOOM של ספלים שופ`;
  const shareTitle = `BLOOM · ${heName}`;

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`${shareText} ${shareUrl}`);
    window.open(`https://wa.me/?text=${msg}`, `_blank`, `noopener,noreferrer`);
  };

  const handleShare = async () => {
    // Mobile / supported browsers: native share sheet (WhatsApp shows up there
    // on iOS + Android, exactly the surface we want for IL users).
    if (typeof navigator !== `undefined` && typeof navigator.share === `function`) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        // User cancelled the share sheet — silent, that's expected.
        if (err && err.name === `AbortError`) return;
        // Any other failure: fall through to clipboard so the user still has a way to share.
        console.error(`Share failed, falling back to clipboard:`, err);
      }
    }
    // Desktop / no Web Share API: copy the URL to clipboard and offer
    // a WhatsApp deep link via the toast action button.
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch (err) {
      console.error(`Clipboard write failed:`, err);
    }
    if (typeof onShareToast === `function`) {
      onShareToast(
        t.shareCopied || `Link copied!`,
        { label: t.shareWhatsApp || `Share on WhatsApp`, handler: openWhatsApp },
      );
    }
  };

  // Shirt type/size option sets are shared at module scope (BLOOM_SHIRT_TYPES /
  // BLOOM_SHIRT_SIZES) so PetModal and BreedPage render an identical picker.

  // BLOOM shirt prices come from the design's own price columns, not the
  // custom-upload PRODUCTS variants — basic and oversized are flat per row,
  // shared across all sizes. Falls back to legacy design.price_shirt if a
  // (typically pre-migration) row is missing the new column.
  const shirtProductId = shirtType === "oversized" ? "oversized" : "tshirt";
  const shirtPrice = shirtType === "oversized"
    ? (Number(design.price_shirt_oversized) || Number(design.price_shirt) || 0)
    : (Number(design.price_shirt_basic) || Number(design.price_shirt) || 0);

  // Personalization: +₪20 per item when (and only when) a pet name is entered,
  // folded into the price passed to onOrderBloom so it threads into the cart line.
  // The name + chosen font/color also ride the cart line into the order.
  const petTrim = petName.trim();
  const petSurcharge = petTrim ? PET_NAME_SURCHARGE : 0;
  const personalization = {
    petName: petTrim || null,
    petNameFont: petTrim ? petNameFont : null,
    petNameColor: petTrim ? petNameColor : null,
  };

  // Add this BLOOM character to the order cart with its design already fixed.
  // Shirt carries the chosen type, size and color; mug/sticker keep defaults.
  const handleOrder = (kind) => {
    if (!design.design_url) return;
    // The polished image the customer is actually looking at in this modal —
    // saved on the order so the order preview matches what they saw.
    const mockupUrl =
      kind === `mug` ? (design.mockup_mug_url || design.mockup_url || design.design_url) :
      kind === `shirt` ? (
        (selectedColor?.id === `black` ? design.mockup_shirt_black_url : design.mockup_shirt_white_url) ||
        design.mockup_shirt_url || design.mockup_url || design.design_url
      ) :
      (design.mockup_url || design.design_url);
    if (kind === "shirt") {
      onOrderBloom({
        productId: shirtProductId,
        variantId: shirtSize,
        price: (Number(shirtPrice) || 0) + petSurcharge,
        designUrl: design.design_url,
        mockupUrl,
        characterName: name,
        shirtColor: selectedColor,
        ...personalization,
      });
      return;
    }
    // Single-sticker purchase was retired (stickers are pack-only / free
    // gift now), so the only remaining non-shirt kind is `mug`.
    const map = {
      mug: { productId: "mug", price: design.price_mug },
    };
    const choice = map[kind];
    if (!choice) return;
    onOrderBloom({
      productId: choice.productId,
      price: (Number(choice.price) || 0) + petSurcharge,
      designUrl: design.design_url,
      mockupUrl,
      characterName: name,
      shirtColor: null,
      ...personalization,
    });
  };

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // A11y: trap focus inside the modal while open; restore to the trigger on close.
  const petDialogRef = useDialogFocus(true);

  // Keyboard: Esc closes the zoom overlay first, then the modal. View nav (←/→)
  // lives in the shared <BloomImageCarousel>; the modal no longer browses breeds.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (zoomed) { setZoomed(false); return; }
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, zoomed]);

  const __overlay = (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 12 : 24,
        animation: "petModalFadeIn 0.3s ease-out",
        direction: isRTL ? "rtl" : "ltr",
        overflowY: "auto",
      }}>
      <div
        ref={petDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pet-modal-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          maxWidth: 1000,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          position: "relative",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,107,53,0.1)",
          animation: "petModalSlideUp 0.4s cubic-bezier(.2,.6,.2,1)",
        }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: "absolute",
          top: 16,
          insetInlineEnd: 16,
          width: 40, height: 40,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: "50%",
          color: COLORS.white,
          cursor: "pointer",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          transition: "all 0.2s",
        }}
        onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.borderColor = COLORS.accent; }}
        onMouseOut={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; e.currentTarget.style.borderColor = COLORS.border; }}
        aria-label={t.modalClose}
        >×</button>

        {/* Share button — sits next to the close button, on the same side as
            close so they read as a header control cluster. Same circle/blur
            treatment so it visually belongs. On mobile the native share sheet
            shows WhatsApp first for IL users; on desktop it copies the link
            and offers a WhatsApp tab via the toast. */}
        <button onClick={handleShare} type="button" style={{
          position: "absolute",
          top: 16,
          insetInlineEnd: 64,
          height: 40,
          padding: "0 14px",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          color: COLORS.white,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Varela Round',sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 6,
          zIndex: 10,
          transition: "all 0.2s",
          touchAction: "manipulation",
        }}
        onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.borderColor = COLORS.accent; }}
        onMouseOut={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; e.currentTarget.style.borderColor = COLORS.border; }}
        aria-label={t.shareBtn || `Share`}
        title={t.shareBtn || `Share`}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>↗</span>
          <span>{t.shareBtn || `Share`}</span>
        </button>

        {/* Favorite heart — top inline-start, opposite the close/share cluster */}
        <div style={{ position: "absolute", top: 16, insetInlineStart: 16, zIndex: 10 }}>
          <FavHeart slug={design.slug} name={name} lang={lang} size={40} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 0, alignItems: "start" }}>
          {/* Image — shared in-place view carousel (panel = the modal's dark
              image panel). Flips THIS breed's views (portrait/white/black/mug);
              it no longer browses breeds. Same component the breed page uses.
              The live pet-name preview sits directly under it. */}
          <div>
            <BloomImageCarousel
              design={design} lang={lang} isMobile={isMobile}
              previewProduct={previewProduct} setPreviewProduct={setPreviewProduct}
              selectedColor={selectedColor} setSelectedColor={setSelectedColor}
              zoomed={zoomed} setZoomed={setZoomed}
              panel
            />
            <PetNamePreview name={petName} font={petNameFont} color={petNameColor} />
          </div>

          {/* Info */}
          <div style={{ padding: isMobile ? "28px 24px" : "40px 36px", display: "flex", flexDirection: "column" }}>
            <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 10, letterSpacing: "2px", marginBottom: 16, textTransform: "uppercase" }}>
              {`BLOOM ${LANGS[lang].bloom.collection}`}
            </div>

            <h2 id="pet-modal-title" style={{
              fontFamily: "'Playfair Display',serif",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: isMobile ? "2.5rem" : "3.5rem",
              color: COLORS.white,
              margin: "0 0 4px 0",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}>{name}</h2>

            <div style={{
              color: COLORS.gray,
              fontFamily: "'IBM Plex Mono','Courier New',monospace",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}>{animal}</div>

            <div style={{
              color: COLORS.accent,
              fontFamily: "'Playfair Display',serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: isMobile ? 18 : 22,
              marginBottom: 28,
            }}>— {tagline}</div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ width: 30, height: 1, background: COLORS.accent }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
            </div>

            {/* Quick-look → full breed page (Task 7). The modal stays the fast
                browse view; this opens the rich standalone page for the breed. */}
            {goToBreed && design.slug && (
              <button
                type="button"
                onClick={() => goToBreed(design.slug)}
                style={{ alignSelf: isRTL ? `flex-end` : `flex-start`, background: `transparent`, border: `none`, color: COLORS.accent, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, fontWeight: 700, cursor: `pointer`, padding: 0, marginBottom: 20, display: `inline-flex`, alignItems: `center`, gap: 6 }}
                onMouseOver={e => { e.currentTarget.style.textDecoration = `underline`; }}
                onMouseOut={e => { e.currentTarget.style.textDecoration = `none`; }}>
                <span aria-hidden="true">📄</span>
                <span>{lang === `he` ? `לעמוד הגזע המלא ←` : lang === `ru` ? `Открыть страницу породы →` : `View full breed page →`}</span>
              </button>
            )}

            {/* Pre-launch: the entire purchase block (product picker + add-to-
                cart) is replaced by a breed-specific "Join the BLOOM Family"
                CTA that records breed_interest = this slug. The breed story
                below still renders. */}
            {preview && (
              <div style={{ marginBottom: 24 }}>
                <JoinBloomCTA lang={lang} source="breed" breedInterest={design.slug} breedName={name} variant="breed" />
              </div>
            )}

            {!preview && (<>
            <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14 }}>
              {t.availableOn}
            </div>

            {/* Optional pet-name personalization (Task 8). The name is printed
                on the product; it rides the cart line into the order and shows
                in the admin order view. Empty → omitted. Shared shape with
                BreedPage. */}
            <PetNameInput lang={lang} t={t} value={petName} onChange={setPetName} font={petNameFont} onFont={setPetNameFont} color={petNameColor} onColor={setPetNameColor} />

            {/* Shirt color/type/size — shown only when the shirt product is
                selected. Shared with BreedPage via <BloomShirtOptions>. */}
            {previewProduct === `shirt` && (
              <BloomShirtOptions
                lang={lang}
                selectedColor={selectedColor} setSelectedColor={setSelectedColor}
                shirtType={shirtType} setShirtType={setShirtType}
                shirtSize={shirtSize} setShirtSize={setShirtSize}
                onColorPreview={() => setPreviewProduct(`shirt`)}
              />
            )}

            {/* Product buttons. Single stickers used to be a paid option here
                — now they're a free gift only, and customers who want stickers
                buy a bundled pack from the PetsPage packs section instead. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <ProductOption label={t.shirtLabel} price={shirtPrice} onClick={() => setPreviewProduct(`shirt`)} disabled={!design.design_url} selected={previewProduct === `shirt`} />
              <ProductOption label={t.mugLabel} price={design.price_mug} onClick={() => setPreviewProduct(`mug`)} disabled={!design.design_url} selected={previewProduct === `mug`} />
            </div>
            {/* Add to cart — appears only after a product is selected; adds the
                currently-previewed product (color-aware for shirts). */}
            {previewProduct && (
              <button
                onClick={() => handleOrder(previewProduct)}
                disabled={!design.design_url}
                onMouseOver={e => { if (design.design_url) e.currentTarget.style.background = COLORS.accentBtnHover; }}
                onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; }}
                style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 10, padding: "16px 20px", marginBottom: 16, cursor: design.design_url ? "pointer" : "not-allowed", opacity: design.design_url ? 1 : 0.5, fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}
              >
                🛒 {lang === "he" ? "הוסף לעגלה" : lang === "ru" ? "В корзину" : "Add to cart"} · ₪{(previewProduct === `mug` ? Number(design.price_mug) : Number(shirtPrice)) + petSurcharge}
              </button>
            )}
            {/* Made-to-order caption. Reassures the customer that delivery
                isn't same-day and sets expectations on production lead time. */}
            {(t.madeToOrder || t.dispatchTime) && (
              <div style={{ display: `flex`, alignItems: `center`, gap: 10, marginBottom: 24, padding: `10px 12px`, background: `rgba(255,107,53,0.06)`, border: `1px solid rgba(255,107,53,0.18)`, borderRadius: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: `50%`, background: COLORS.accent, flexShrink: 0 }} />
                <div style={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
                  {t.madeToOrder && <span style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, letterSpacing: `0.04em` }}>{t.madeToOrder}</span>}
                  {t.dispatchTime && <span style={{ color: COLORS.gray, fontSize: 11, fontFamily: `'Varela Round',sans-serif` }}>{t.dispatchTime}</span>}
                </div>
              </div>
            )}
            </>)}
            {/* About the breed — origin + fun facts (content-writer agent).
                Shared with BreedPage; renders null when the breed has no content. */}
            <BreedStoryCard design={design} lang={lang} />

            {/* Slice 3: link to the breed's blog post when one is published. */}
            {breedPost && goToBlog && (
              <button
                type="button"
                onClick={() => goToBlog(breedPost.slug)}
                style={{ marginTop: 4, marginBottom: 8, background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 10, padding: `12px 18px`, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, cursor: `pointer`, display: `flex`, alignItems: `center`, justifyContent: `center`, gap: 8, width: `100%`, transition: `background 0.2s, color 0.2s` }}
                onMouseOver={(e) => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.color = `#fff`; }}
                onMouseOut={(e) => { e.currentTarget.style.background = `transparent`; e.currentTarget.style.color = COLORS.accent; }}>
                {(LANGS[lang] || LANGS.he).blogReadMoreBreed}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes petModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes petModalSlideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
  // Portal the modal to <body> so a filtered #root (high-contrast) can't become
  // its containing block and push the fixed overlay off-screen.
  return typeof document !== `undefined` ? createPortal(__overlay, document.body) : __overlay;
}

// ============ Product option button inside modal ============
function ProductOption({ label, price, onClick, disabled, selected }) {
  const [hovered, setHovered] = useState(false);
  const active = !disabled && (selected || hovered);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: disabled ? "transparent" : (selected ? "rgba(255,107,53,0.14)" : (hovered ? "rgba(255,107,53,0.1)" : COLORS.bg)),
        border: `2px solid ${active ? COLORS.accent : COLORS.border}`,
        borderRadius: 10,
        padding: "15px 19px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "all 0.25s",
        opacity: disabled ? 0.4 : 1,
        width: "100%",
        textAlign: "inherit",
      }}>
      <span style={{ color: active ? COLORS.accent : COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 15, fontWeight: 600, transition: "color 0.2s" }}>{label}</span>
      <span style={{ color: COLORS.accent, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 24, fontWeight: 800, letterSpacing: "0.01em" }}>₪{price}</span>
    </button>
  );
}

// ============ BLOOM HERO IMAGE — shared by the modal + breed page ============
// The BLOOM portrait artwork already has its own orange frame baked in (on a
// transparent bg), so we add NO frame — just show the WHOLE image (object-fit
// contain) capped to a fraction of the viewport, so the artwork's own frame is
// always fully visible with breathing room and never clipped. Product mockups
// (shirt/mug) have no baked frame and show cleanly too. Centred by the caller;
// badges hug the image. ONE component so the modal + breed page never drift.
function BloomHeroImage({ src, alt, design, lang, isMobile }) {
  return (
    <span style={{ position: `relative`, display: `inline-block`, lineHeight: 0, maxWidth: `100%` }}>
      <SmartImage src={src} alt={alt} style={{ display: `block`, width: `auto`, height: `auto`, maxWidth: `100%`, maxHeight: isMobile ? `min(50vh, 380px)` : `min(55vh, 460px)`, objectFit: `contain` }} />
      {design && <PetBadges design={design} lang={lang} />}
    </span>
  );
}

// ============ BLOOM IMAGE CAROUSEL — shared by the modal + breed page ========
// In-place image gallery for ONE breed: flips between THAT breed's views
// (portrait → white tee → black tee → mug, wrapping) with side arrows, a "1/N"
// counter, enlarge/zoom overlay, swipe and ←/→ keys. Each view's apply() sets the
// SAME previewProduct/selectedColor the buy panel reads, so the hero image and the
// selected product stay in sync. It does NOT browse breeds — to see another breed
// the user closes the modal and clicks another card.
//   `zoomed`/`setZoomed` are owned by the parent so the parent controls Esc (the
//   modal closes the modal on Esc when NOT zoomed); this component only opens the
//   overlay + handles ←/→. `panel` gives the modal its dark image panel; the breed
//   page floats the image on the page bg. ONE component so the two never drift.
function BloomImageCarousel({ design, lang, isMobile, previewProduct, setPreviewProduct, selectedColor, setSelectedColor, zoomed, setZoomed, panel = false }) {
  const name = design[`name_${lang}`] || design.name_en || design.name_he || ``;
  const fallbackBg = design.mockup_bg || `#1a1a1a`;
  const zoomLabel = lang === `he` ? `הגדל` : lang === `ru` ? `Увеличить` : `Zoom`;
  const imgSrc =
    (previewProduct === `mug` && design.mockup_mug_url) ||
    (previewProduct === `shirt` && selectedColor?.id === `black` && design.mockup_shirt_black_url) ||
    (previewProduct === `shirt` && selectedColor?.id === `white` && design.mockup_shirt_white_url) ||
    (previewProduct === `shirt` && design.mockup_shirt_url) ||
    design.mockup_shirt_url || design.mockup_url || design.design_url;

  // Ordered views; each apply() drives the same preview state the buy panel reads.
  const views = [
    design.mockup_url && { key: `portrait`, src: design.mockup_url, apply: () => setPreviewProduct(null) },
    design.mockup_shirt_white_url && { key: `shirt-white`, src: design.mockup_shirt_white_url, apply: () => { setPreviewProduct(`shirt`); setSelectedColor(BLOOM_SHIRT_COLORS[0]); } },
    design.mockup_shirt_black_url && { key: `shirt-black`, src: design.mockup_shirt_black_url, apply: () => { setPreviewProduct(`shirt`); setSelectedColor(BLOOM_SHIRT_COLORS[1]); } },
    design.mockup_mug_url && { key: `mug`, src: design.mockup_mug_url, apply: () => setPreviewProduct(`mug`) },
  ].filter(Boolean);
  const currentViewKey =
    previewProduct === `mug` ? `mug` :
    previewProduct === `shirt` ? (selectedColor?.id === `black` ? `shirt-black` : `shirt-white`) :
    `portrait`;
  const viewIdx = Math.max(0, views.findIndex(v => v.key === currentViewKey));
  const goView = (dir) => { if (views.length < 2) return; const n = views.length; views[(viewIdx + dir + n) % n].apply(); };

  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || views.length < 2 || zoomed) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) goView(1);
    else if (diff < -50) goView(-1);
    touchStartX.current = null;
  };

  // ←/→ step through views (ignored while typing or zoomed). Esc is the parent's
  // job (so the modal can close the modal on Esc when not zoomed).
  useEffect(() => {
    const onKey = (e) => {
      if (zoomed) return;
      const el = typeof document !== `undefined` ? document.activeElement : null;
      if (el && (el.tagName === `INPUT` || el.tagName === `TEXTAREA`)) return;
      if (e.key === `ArrowRight`) { e.preventDefault(); goView(1); }
      else if (e.key === `ArrowLeft`) { e.preventDefault(); goView(-1); }
    };
    window.addEventListener(`keydown`, onKey);
    return () => window.removeEventListener(`keydown`, onKey);
  }, [zoomed, viewIdx, views.length]);

  // A11y: focus-trap + restore for the full-screen zoom lightbox.
  const zoomDialogRef = useDialogFocus(zoomed);

  const arrowStyle = (side) => ({ position: `absolute`, top: `50%`, [side]: isMobile ? 6 : 8, transform: `translateY(-50%)`, width: isMobile ? 48 : 42, height: isMobile ? 48 : 42, border: `none`, borderRadius: `50%`, background: `rgba(0,0,0,0.55)`, color: COLORS.accent, cursor: `pointer`, display: `flex`, alignItems: `center`, justifyContent: `center`, zIndex: 4, backdropFilter: `blur(8px)`, WebkitBackdropFilter: `blur(8px)`, touchAction: `manipulation`, transition: `transform 0.18s cubic-bezier(.2,.6,.2,1), background 0.18s, color 0.18s` });

  return (
    <>
      <div style={{ display: `flex`, justifyContent: `center`, ...(panel ? { background: design.mockup_url ? `#1a1a1a` : fallbackBg, minHeight: isMobile ? 300 : 440, alignItems: `center` } : {}) }}>
        <div
          onClick={() => { if (views.length) setZoomed(true); }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          title={lang === `he` ? `לחץ להגדלה` : lang === `ru` ? `Нажмите, чтобы увеличить` : `Click to zoom`}
          style={{ position: `relative`, cursor: `zoom-in`, touchAction: `pan-y`, padding: isMobile ? `10px 12px` : `12px 18px` }}>
          <BloomHeroImage src={imgSrc} alt={name} design={design} lang={lang} isMobile={isMobile} />

          {views.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); goView(-1); }}
                aria-label={lang === `he` ? `תמונה קודמת` : lang === `ru` ? `Предыдущее изображение` : `Previous image`}
                className="bloom-nav-btn" style={arrowStyle(`insetInlineStart`)}>
                <svg width={isMobile ? 26 : 22} height={isMobile ? 26 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points={lang === `he` ? `9 18 15 12 9 6` : `15 18 9 12 15 6`} />
                </svg>
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goView(1); }}
                aria-label={lang === `he` ? `תמונה הבאה` : lang === `ru` ? `Следующее изображение` : `Next image`}
                className="bloom-nav-btn" style={arrowStyle(`insetInlineEnd`)}>
                <svg width={isMobile ? 26 : 22} height={isMobile ? 26 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points={lang === `he` ? `15 18 9 12 15 6` : `9 18 15 12 9 6`} />
                </svg>
              </button>
              <div aria-live="polite" style={{ position: `absolute`, bottom: 10, left: `50%`, transform: `translateX(-50%)`, direction: `ltr`, background: `rgba(0,0,0,0.55)`, color: `#fff`, borderRadius: 20, padding: `5px 14px`, fontSize: 11, fontFamily: "'IBM Plex Mono','Courier New',monospace", letterSpacing: `0.12em`, backdropFilter: `blur(6px)`, pointerEvents: `none` }}>
                {viewIdx + 1} / {views.length}
              </div>
            </>
          )}

          {/* Enlarge button */}
          <button type="button" onClick={(e) => { e.stopPropagation(); setZoomed(true); }} aria-label={zoomLabel}
            style={{ position: `absolute`, bottom: 10, insetInlineEnd: 10, background: `rgba(0,0,0,0.55)`, color: `#fff`, border: `none`, borderRadius: 20, padding: `6px 11px`, display: `flex`, alignItems: `center`, gap: 6, fontSize: 11, fontFamily: "'Varela Round',sans-serif", letterSpacing: `0.05em`, backdropFilter: `blur(6px)`, cursor: `pointer`, zIndex: 4 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span>{zoomLabel}</span>
          </button>
        </div>
      </div>

      {zoomed && (typeof document !== `undefined` ? createPortal(
        <div onClick={() => setZoomed(false)} role="dialog" aria-modal="true"
          ref={zoomDialogRef}
          onKeyDown={(e) => { if (e.key === `Escape`) setZoomed(false); }}
          aria-label={lang === `he` ? `תמונה מוגדלת` : lang === `ru` ? `Увеличенное изображение` : `Zoomed image`}
          style={{ position: `fixed`, inset: 0, zIndex: 1100, background: `rgba(0,0,0,0.95)`, backdropFilter: `blur(8px)`, WebkitBackdropFilter: `blur(8px)`, display: `flex`, alignItems: `center`, justifyContent: `center`, padding: 16, cursor: `zoom-out`, animation: `bloomZoomFadeIn 0.2s ease-out` }}>
          <SmartImage src={imgSrc} alt={name} style={{ maxWidth: `100%`, maxHeight: `100%`, objectFit: `contain`, boxShadow: `0 30px 80px rgba(0,0,0,0.6)` }} />
          <button onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            aria-label={lang === `he` ? `סגירה` : lang === `ru` ? `Закрыть` : `Close`}
            style={{ position: `absolute`, top: 20, insetInlineEnd: 20, width: 44, height: 44, background: `rgba(255,255,255,0.1)`, border: `1px solid rgba(255,255,255,0.25)`, borderRadius: `50%`, color: `#fff`, cursor: `pointer`, fontSize: 22, display: `flex`, alignItems: `center`, justifyContent: `center`, backdropFilter: `blur(10px)` }}>×</button>
          <style>{`@keyframes bloomZoomFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
      , document.body) : null)}
    </>
  );
}

// ============ PET NAME INPUT — live personalization (free) ============
// Shared by PetModal and BreedPage (customizable products only). The name is
// ALWAYS-visible + optional, max 20 chars, strips angle brackets. FREE — no
// price effect. Progressive disclosure: the FONT + COLOR pickers appear only
// once a non-empty (trimmed) name is typed; clearing the name hides them and
// resets font/color to defaults. The live preview lives separately (under the
// design image) via <PetNamePreview>. Reads t.petName* labels.
function PetNameInput({ lang, t, value, onChange, font, onFont, color, onColor }) {
  const isRTL = lang === `he`;
  const show = (value || ``).trim().length > 0;
  const handleName = (raw) => {
    const next = raw.replace(/[<>]/g, ``).slice(0, 20);
    onChange(next);
    // Cleared → hide pickers AND clear the stored font/color (back to defaults).
    if (!next.trim()) { onFont && onFont(PET_NAME_FONT_DEFAULT); onColor && onColor(PET_NAME_COLOR_DEFAULT); }
  };
  const pickerLabelStyle = { display: `block`, color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 };
  return (
    <div style={{ marginBottom: 20, background: `rgba(255,107,53,0.06)`, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 12, padding: `15px 16px 17px` }}>
      <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, gap: 10, marginBottom: 12 }}>
        <span style={{ display: `inline-flex`, alignItems: `center`, gap: 8 }}>
          <span aria-hidden="true" style={{ display: `inline-flex`, color: COLORS.accent }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3z" /></svg>
          </span>
          <span style={{ color: COLORS.accent, fontFamily: "'Varela Round',sans-serif", fontSize: 15, fontWeight: 700 }}>{t.petNameTitle}</span>
        </span>
        <span style={{ background: COLORS.accentBtn, color: `#fff`, fontFamily: "'Varela Round',sans-serif", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: `3px 11px`, whiteSpace: `nowrap` }}>{`+₪${PET_NAME_SURCHARGE}`}</span>
      </div>
      <label htmlFor="bloom-pet-name" style={{ display: `block`, color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{t.petNameLabel}</label>
      <input
        id="bloom-pet-name"
        type="text"
        value={value}
        onChange={(e) => handleName(e.target.value)}
        placeholder={t.petNamePlaceholder}
        maxLength={20}
        dir={isRTL ? `rtl` : `ltr`}
        style={{ width: `100%`, boxSizing: `border-box`, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `12px 14px`, color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: `none`, transition: `border-color 0.2s` }}
        onFocus={(e) => { e.currentTarget.style.borderColor = COLORS.accent; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = COLORS.border; }}
      />
      {t.petNameHelper && <div style={{ color: COLORS.gray, fontSize: 11, fontFamily: "'Varela Round',sans-serif", marginTop: 6, lineHeight: 1.5 }}>{t.petNameHelper}</div>}

      {/* Progressive disclosure — only after a name is typed. */}
      {show && (
        <>
          <div role="group" aria-label={t.petNameFontLabel} style={{ marginTop: 16 }}>
            <span style={pickerLabelStyle}>{t.petNameFontLabel}</span>
            <div style={{ display: `flex`, flexWrap: `wrap`, gap: 8 }}>
              {PET_NAME_FONTS.map((f) => {
                const active = font === f;
                return (
                  <button key={f} type="button" onClick={() => onFont && onFont(f)} aria-pressed={active}
                    style={{ fontFamily: `'${f}', sans-serif`, fontSize: 15, lineHeight: 1, padding: `9px 12px`, borderRadius: 8, cursor: `pointer`,
                      background: active ? `rgba(255,107,53,0.18)` : COLORS.bg,
                      border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                      color: active ? COLORS.accent : COLORS.white, transition: `border-color 0.15s, color 0.15s, background 0.15s` }}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div role="group" aria-label={t.petNameColorLabel} style={{ marginTop: 16 }}>
            <span style={pickerLabelStyle}>{t.petNameColorLabel}</span>
            <div style={{ display: `flex`, flexWrap: `wrap`, gap: 10 }}>
              {PET_NAME_COLORS.map((c) => {
                const active = color === c;
                return (
                  <button key={c} type="button" onClick={() => onColor && onColor(c)} aria-pressed={active} aria-label={petColorName(c, lang)} title={petColorName(c, lang)}
                    style={{ width: 30, height: 30, borderRadius: `50%`, background: c, cursor: `pointer`, padding: 0,
                      border: active ? `2px solid ${COLORS.white}` : `1px solid #555`,
                      boxShadow: active ? `0 0 0 2px ${COLORS.accent}` : `none`, transition: `box-shadow 0.15s` }} />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ PET NAME LIVE PREVIEW ============
// Shown UNDER the design image while the customer types. Renders the typed name
// large, in the chosen font + color, on a light-orange rounded background. Only
// appears when a name is present. Hebrew text → RTL, Latin → LTR.
function PetNamePreview({ name, font, color }) {
  const v = (name || ``).trim();
  if (!v) return null;
  return (
    <div style={{ marginTop: 14, background: `rgba(255,107,53,0.12)`, borderRadius: 14, padding: `18px 16px`, textAlign: `center` }}>
      <div dir={hasHebrew(v) ? `rtl` : `ltr`} style={{
        fontFamily: `'${font || PET_NAME_FONT_DEFAULT}', sans-serif`,
        color: color || PET_NAME_COLOR_DEFAULT,
        fontSize: `clamp(32px, 8vw, 48px)`,
        fontWeight: 700, lineHeight: 1.15, wordBreak: `break-word`,
      }}>{v}</div>
    </div>
  );
}

// ============ ADMIN — pet-name personalization block ============
// Shown in the admin order view whenever an order/line has a pet_name. Makes the
// print-ready personalization obvious: the name rendered in its chosen font +
// color, plus the font name and the colour hex + swatch. Renders nothing when
// there is no pet_name (no empty block). `order` = an order row (has pet_name /
// pet_name_font / pet_name_color).
function AdminPetNameBlock({ order, lang }) {
  if (!order || !order.pet_name) return null;
  const font = order.pet_name_font || PET_NAME_FONT_DEFAULT;
  const color = order.pet_name_color || PET_NAME_COLOR_DEFAULT;
  const label = lang === `he` ? `התאמה אישית · שם להדפסה` : lang === `ru` ? `Персонализация · имя для печати` : `Personalization · name to print`;
  const fontLbl = lang === `he` ? `גופן` : lang === `ru` ? `Шрифт` : `Font`;
  const colorLbl = lang === `he` ? `צבע` : lang === `ru` ? `Цвет` : `Color`;
  return (
    <div style={{ marginTop: 8, marginBottom: 8, background: `rgba(255,107,53,0.12)`, border: `1px solid ${COLORS.accent}`, borderRadius: 8, padding: `10px 12px` }}>
      <div style={{ color: COLORS.accent, fontSize: 10.5, fontWeight: 700, textTransform: `uppercase`, letterSpacing: `0.12em`, marginBottom: 8, display: `inline-flex`, alignItems: `center`, gap: 5 }}>
        <span aria-hidden="true" style={{ display: `inline-flex` }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3z" /></svg></span>{label}
      </div>
      <div dir={hasHebrew(order.pet_name) ? `rtl` : `ltr`} style={{ fontFamily: `'${font}', sans-serif`, color, fontSize: 26, fontWeight: 700, lineHeight: 1.2, wordBreak: `break-word`, marginBottom: 8 }}>{order.pet_name}</div>
      <div style={{ display: `flex`, flexWrap: `wrap`, gap: 14, alignItems: `center`, color: COLORS.gray, fontSize: 11 }}>
        <span>{fontLbl}: <span style={{ color: COLORS.white, fontWeight: 600 }}>{font}</span></span>
        <span style={{ display: `inline-flex`, alignItems: `center`, gap: 6 }}>{colorLbl}:
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: `50%`, background: color, border: `1px solid #555`, display: `inline-block` }} />
          <span style={{ color: COLORS.white, fontWeight: 600, fontFamily: "'IBM Plex Mono','Courier New',monospace" }}>{color}</span>
        </span>
      </div>
    </div>
  );
}

// ============ BREED STORY CARD — origin + fun facts (shared) ============
// Renders the "About the breed" card from the breed_origin_* / breed_facts_*
// columns. Used by both PetModal and BreedPage so the story stays identical.
// Returns null when the breed has no content (legacy rows stay clean).
function BreedStoryCard({ design, lang }) {
  if (!design || !design[`breed_origin_${lang}`]) return null;
  const isRTL = lang === `he`;
  return (
    <div style={{ marginBottom: 24, padding: `16px 18px`, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, textAlign: isRTL ? `right` : `left` }}>
      <div style={{ color: COLORS.accent, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, marginBottom: 8, display: `flex`, alignItems: `center`, gap: 6 }}>
        <span aria-hidden="true" style={{ display: `inline-flex` }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="5.5" cy="12" rx="1.7" ry="2.3" /><ellipse cx="9.5" cy="8.5" rx="1.8" ry="2.5" /><ellipse cx="14.5" cy="8.5" rx="1.8" ry="2.5" /><ellipse cx="18.5" cy="12" rx="1.7" ry="2.3" /><path d="M12 12.5c-2.8 0-4.8 2.1-4.8 4.3 0 1.8 1.8 2.7 4.8 2.7s4.8-.9 4.8-2.7c0-2.2-2-4.3-4.8-4.3z" /></svg></span>
        <span>{lang === `he` ? `על הגזע` : lang === `ru` ? `О породе` : `About the breed`}</span>
      </div>
      <p style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{design[`breed_origin_${lang}`]}</p>
      {design[`breed_facts_${lang}`] && (
        <ul style={{ margin: 0, marginTop: 12, padding: 0, listStyle: `none`, display: `flex`, flexDirection: `column`, gap: 7 }}>
          {String(design[`breed_facts_${lang}`]).split(/\n/).filter(Boolean).map((fact, i) => (
            <li key={i} style={{ color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 13.5, lineHeight: 1.5, display: `flex`, alignItems: `flex-start`, gap: 8 }}>
              <span style={{ color: COLORS.accent, fontWeight: 700, flexShrink: 0 }}>•</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============ BLOOM SHIRT OPTIONS — color / type / size (shared) ============
// Pure presentational picker. Holds no state of its own — the parent (PetModal
// or BreedPage) owns the selection so its preview image can react. onColorPreview
// lets the parent flip its preview to the shirt when a color is tapped.
function BloomShirtOptions({ lang, selectedColor, setSelectedColor, shirtType, setShirtType, shirtSize, setShirtSize, onColorPreview }) {
  return (
    <>
      {/* Shirt color picker — choice is saved for ordering */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase" }}>
            {lang === "he" ? "צבע חולצה" : lang === "ru" ? "Цвет футболки" : "Shirt color"}
          </span>
          <span style={{ color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 12, fontWeight: 600 }}>
            {selectedColor[lang] || selectedColor.en}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {BLOOM_SHIRT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setSelectedColor(c); if (onColorPreview) onColorPreview(); }}
              title={c[lang] || c.en}
              aria-label={c[lang] || c.en}
              aria-pressed={selectedColor.id === c.id}
              style={{
                width: 32, height: 32, borderRadius: "50%", background: c.hex, cursor: "pointer", padding: 0,
                border: `3px solid ${selectedColor.id === c.id ? COLORS.accent : "transparent"}`,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
                transition: "transform 0.15s, border-color 0.15s",
                transform: selectedColor.id === c.id ? "scale(1.18)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Shirt type — Basic / Oversized */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>
          {lang === "he" ? "סוג חולצה" : lang === "ru" ? "Тип футболки" : "Shirt type"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {BLOOM_SHIRT_TYPES.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={shirtType === st.id}
              onClick={() => setShirtType(st.id)}
              style={{
                flex: 1,
                background: shirtType === st.id ? COLORS.accentBtn : COLORS.bg,
                border: `1px solid ${shirtType === st.id ? COLORS.accent : COLORS.border}`,
                color: shirtType === st.id ? "#fff" : COLORS.white,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600,
                transition: "background 0.2s, border-color 0.2s",
              }}
            >{st.label[lang] || st.label.en}</button>
          ))}
        </div>
      </div>

      {/* Shirt size — S / M / L / XL / XXL */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>
          {lang === "he" ? "מידה" : lang === "ru" ? "Размер" : "Size"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BLOOM_SHIRT_SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              aria-pressed={shirtSize === sz}
              onClick={() => setShirtSize(sz)}
              style={{
                minWidth: 46,
                background: shirtSize === sz ? COLORS.accentBtn : COLORS.bg,
                border: `1px solid ${shirtSize === sz ? COLORS.accent : COLORS.border}`,
                color: shirtSize === sz ? "#fff" : COLORS.white,
                borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600,
                transition: "background 0.2s, border-color 0.2s",
              }}
            >{sz.toUpperCase()}</button>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ BREED PAGE — full per-character page (#/breed/<slug>) ============
// Bottom-of-breed-page rail: a gentle infinite marquee of the WHOLE active BLOOM
// roster (all 70 — dogs + cats). Each portrait carries its own baked-in orange
// frame on a transparent bg, so it FLOATS (no card box). The whole thing runs on
// scrollLeft: a rAF loop drifts it sideways, hover (desktop) / touch (mobile)
// pauses it, and it's draggable by hand (mouse) or swipeable (native touch).
// Two back-to-back copies of the list make the wrap seamless. Images lazy-load
// so 70 portraits stay light. Click a portrait → that breed's page.
function BloomCharacterRail({ characters, lang, goToBreed, isMobile, heading }) {
  const scrollerRef = useRef(null);
  const pausedRef = useRef(false);
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  // Render the list twice; once we drift past one full set we subtract its
  // width, landing on the identical frame — so the loop never visibly jumps.
  const loop = characters.concat(characters);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || characters.length === 0) return;
    let raf = 0, last = 0;
    // Float accumulator: el.scrollLeft is integer-quantized, so adding a sub-pixel
    // amount per frame and reading it back would round away every frame (the rail
    // would never move). We track the true position in `pos` and write it out.
    let pos = el.scrollLeft;
    const SPEED = isMobile ? 0.022 : 0.03; // px per ms — a slow, gentle drift
    const tick = (ts) => {
      if (pausedRef.current || dragRef.current.active) {
        // Paused (hover/touch) or hand-dragging: let scrollLeft be the truth and
        // resync, so auto-scroll resumes smoothly from wherever the user left it.
        pos = el.scrollLeft;
      } else if (last) {
        pos += SPEED * (ts - last);
        const half = el.scrollWidth / 2;
        if (half > 0) { if (pos >= half) pos -= half; else if (pos < 0) pos += half; }
        el.scrollLeft = pos;
      }
      last = ts;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [characters.length, isMobile]);

  // Mouse drag (desktop). Touch keeps native scroll/momentum — don't hijack it.
  const onPointerDown = (e) => {
    if (e.pointerType !== `mouse`) return;
    const el = scrollerRef.current;
    dragRef.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const el = scrollerRef.current;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    const half = el.scrollWidth / 2;
    let next = dragRef.current.startScroll - dx;
    if (half > 0) {
      // Keep the drag seamless in BOTH directions across the wrap boundary.
      if (next < 0) { next += half; dragRef.current.startScroll += half; }
      else if (next >= half) { next -= half; dragRef.current.startScroll -= half; }
    }
    el.scrollLeft = next;
  };
  const endDrag = () => { dragRef.current.active = false; };

  if (!characters.length) return null;

  return (
    <div style={{ marginTop: isMobile ? 48 : 64 }}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.5rem" : "2rem", color: COLORS.white, margin: "0 0 24px" }}>{heading}</h2>
      <div
        ref={scrollerRef}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; endDrag(); }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="bloom-rail"
        style={{
          display: `flex`,
          gap: isMobile ? 14 : 20,
          overflowX: `auto`,
          overflowY: `hidden`,
          direction: `ltr`,          // normalize scrollLeft regardless of page RTL
          scrollbarWidth: `none`,    // Firefox: hide the bar
          touchAction: `pan-x`,      // swipe the rail without blocking vertical page scroll
          WebkitOverflowScrolling: `touch`,
          cursor: `grab`,
          padding: `4px 2px 10px`,
        }}>
        {loop.map((c, i) => {
          const nm = c[`name_${lang}`] || c.name_en || c.name_he || ``;
          // Prefer the portrait — it carries the baked-in orange frame.
          const img = c.mockup_url || c.mockup_shirt_url || c.mockup_mug_url;
          return (
            <button
              key={`${c.slug}-${i}`}
              type="button"
              // Suppress the click that ends a drag (so dragging never navigates).
              onClick={() => { if (!dragRef.current.moved) goToBreed(c.slug); }}
              aria-label={nm}
              style={{ flex: `0 0 auto`, width: isMobile ? 118 : 150, background: `transparent`, border: `none`, padding: 0, cursor: `pointer`, textAlign: `center`, transition: `transform 0.2s` }}
              onMouseOver={e => { e.currentTarget.style.transform = `translateY(-5px)`; }}
              onMouseOut={e => { e.currentTarget.style.transform = `translateY(0)`; }}>
              {/* pointerEvents:none so drags glide over the images to the scroller. */}
              <div style={{ width: `100%`, aspectRatio: `1414 / 2000`, pointerEvents: `none` }}>
                <SmartImage src={img} alt={nm} loading="lazy" decoding="async" draggable={false} style={{ width: `100%`, height: `100%`, objectFit: `contain`, display: `block` }} />
              </div>
              <div style={{ color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 600, padding: `8px 4px 0`, overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap`, pointerEvents: `none` }}>{nm}</div>
            </button>
          );
        })}
      </div>
      <style>{`.bloom-rail::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// Task 7. A rich, routable page for one BLOOM breed. Reuses the shared cart
// (onOrderBloom = addBloomToCart), the ProductOption picker, BloomShirtOptions
// and BreedStoryCard — no cart-logic duplication. Lives behind MAINTENANCE_MODE
// exactly like /pets: in the public pre-launch preview the purchase block
// becomes the "Join the BLOOM Family" CTA.
function BreedPage({ slug, lang, setPage, goToBreed, goToBlog, preview = false, onOrderBloom, onShareToast }) {
  const isRTL = lang === `he`;
  const [isMobile, setIsMobile] = useState(typeof window !== `undefined` && window.innerWidth < 768);
  const [design, setDesign] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Buy state — mirrors PetModal so the hero image reacts to the selection.
  const [selectedColor, setSelectedColor] = useState(BLOOM_SHIRT_COLORS[0]);
  const [shirtType, setShirtType] = useState(`basic`);
  const [shirtSize, setShirtSize] = useState(`m`);
  const [previewProduct, setPreviewProduct] = useState(null); // null | `mug` | `shirt`
  const [petName, setPetName] = useState(``); // optional personalization (free)
  const [petNameFont, setPetNameFont] = useState(PET_NAME_FONT_DEFAULT);
  const [petNameColor, setPetNameColor] = useState(PET_NAME_COLOR_DEFAULT);
  const [zoomed, setZoomed] = useState(false); // full-screen enlarge (shared <BloomImageCarousel>)

  const tt = {
    he: { home: `בית`, collection: `אוסף BLOOM`, available: `זמין עבור`, shirt: `חולצה`, mug: `ספל`, addToCart: `הוסף לעגלה`, made: `נוצר בהזמנה`, dispatch: `זמן ייצור 3-5 ימי עסקים`, relatedDogs: `עוד כלבים`, relatedCats: `עוד חתולים`, related: `גזעים נוספים`, back: `חזרה לאוסף`, notFound: `הגזע לא נמצא`, share: `שתפו`, copied: `הקישור הועתק!`, whatsapp: `שתפו בוואטסאפ`, zoom: `הגדל`, petNameTitle: `התאמה אישית`, petNameLabel: `שם חיית המחמד (אופציונלי)`, petNamePlaceholder: `למשל: רקסי`, petNameHelper: `גודל ההדפסה מותאם למוצר — לבקשות מיוחדות כתבו בהערות.`, petNameFontLabel: `גופן`, petNameColorLabel: `צבע`, railTitle: `כל אוסף BLOOM` },
    en: { home: `Home`, collection: `BLOOM Collection`, available: `Available on`, shirt: `T-shirt`, mug: `Mug`, addToCart: `Add to cart`, made: `Made to order`, dispatch: `Production 3-5 business days`, relatedDogs: `More dogs`, relatedCats: `More cats`, related: `More breeds`, back: `Back to collection`, notFound: `Breed not found`, share: `Share`, copied: `Link copied!`, whatsapp: `Share on WhatsApp`, zoom: `Zoom`, petNameTitle: `Personalization`, petNameLabel: `Pet name (optional)`, petNamePlaceholder: `e.g. Rex`, petNameHelper: `Print size is matched to the product — for special requests, add a note at checkout.`, petNameFontLabel: `Font`, petNameColorLabel: `Color`, railTitle: `The whole BLOOM family` },
    ru: { home: `Главная`, collection: `Коллекция BLOOM`, available: `Доступно на`, shirt: `Футболка`, mug: `Кружка`, addToCart: `В корзину`, made: `Сделано на заказ`, dispatch: `Производство 3-5 рабочих дней`, relatedDogs: `Ещё собаки`, relatedCats: `Ещё кошки`, related: `Другие породы`, back: `Назад к коллекции`, notFound: `Порода не найдена`, share: `Поделиться`, copied: `Ссылка скопирована!`, whatsapp: `Поделиться в WhatsApp`, zoom: `Увеличить`, petNameTitle: `Персонализация`, petNameLabel: `Имя питомца (необязательно)`, petNamePlaceholder: `напр. Рекс`, petNameHelper: `Размер печати подбирается под товар — для особых пожеланий оставьте примечание при оформлении.`, petNameFontLabel: `Шрифт`, petNameColorLabel: `Цвет`, railTitle: `Вся коллекция BLOOM` },
  }[lang] || {};

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener(`resize`, h);
    return () => window.removeEventListener(`resize`, h);
  }, []);

  // Lock body scroll while the enlarge overlay is open (matches the modal).
  useEffect(() => {
    if (!zoomed) return;
    document.body.style.overflow = `hidden`;
    return () => { document.body.style.overflow = ``; };
  }, [zoomed]);

  // Esc closes the enlarge overlay. (←/→ view nav lives in <BloomImageCarousel>.)
  useEffect(() => {
    const onKey = (e) => { if (e.key === `Escape` && zoomed) setZoomed(false); };
    window.addEventListener(`keydown`, onKey);
    return () => window.removeEventListener(`keydown`, onKey);
  }, [zoomed]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setNotFound(false); setLoadError(false); setDesign(null); setRelated([]);
    setPreviewProduct(null); setSelectedColor(BLOOM_SHIRT_COLORS[0]); setShirtType(`basic`); setShirtSize(`m`); setPetName(``);
    window.scrollTo(0, 0);
    if (!slug) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from(`pet_designs`).select(`*`)
        .eq(`slug`, slug).eq(`is_active`, true).maybeSingle();
      if (cancelled) return;
      // Distinguish a load failure (show retry) from a genuinely missing breed
      // (show not-found).
      if (error) { console.error(`[breed] load failed:`, error); setLoadError(true); setLoading(false); return; }
      if (!data) { setNotFound(true); setLoading(false); return; }
      setDesign(data); setLoading(false);
      // Full active roster (all 70 — dogs + cats) for the bottom marquee rail.
      const { data: rel } = await supabase
        .from(`pet_designs`)
        .select(`slug,name_he,name_en,name_ru,mockup_url,mockup_shirt_url,mockup_mug_url,species`)
        .eq(`is_active`, true)
        .order(`sort_order`, { ascending: true });
      if (!cancelled && rel) setRelated(rel);
    })();
    return () => { cancelled = true; };
  }, [slug, reloadKey]);

  // Full per-breed SEO — title + description + Open Graph + Twitter card +
  // Product JSON-LD + canonical/hreflang, set on navigation via the same
  // setMeta/injectJsonLd mechanism the blog uses. The generic site SEO is
  // restored by the parent route effect when leaving (page !== "breed"). The
  // site-wide noindex (index.html) stays until MAINTENANCE_MODE is lifted, so
  // none of this is indexed yet — it's built to be correct at launch.
  useEffect(() => {
    if (typeof document === `undefined` || !design) return;
    const name = design[`name_${lang}`] || design.name_en || design.name_he || ``;
    if (!name) return;
    const origin = (design[`breed_origin_${lang}`] || design.breed_origin_en || design.breed_origin_he || ``).trim();
    const tagline = (design[`tagline_${lang}`] || design.tagline_en || design.tagline_he || ``).trim();
    const title =
      lang === `en` ? `${name} · BLOOM Pet Portrait · Sfalim Shop` :
      lang === `ru` ? `${name} · Портрет BLOOM · Sfalim Shop` :
      `${name} · דיוקן BLOOM · ספלים שופ`;
    const base =
      lang === `en` ? `${name} in BLOOM style — a hand-illustrated pet portrait on premium shirts, mugs & stickers.` :
      lang === `ru` ? `${name} в стиле BLOOM — рисованный портрет питомца на премиальных футболках, кружках и стикерах.` :
      `${name} בסגנון BLOOM — דיוקן חיה מאויר על חולצות, ספלים ומדבקות איכותיים.`;
    const desc = `${base}${origin ? ` ${origin}` : (tagline ? ` ${tagline}` : ``)}`.slice(0, 300);
    const img = design.mockup_url || design.mockup_shirt_url || design.design_url || ``;
    const url = `${SEO_ORIGIN}/breed/${design.slug}`;
    document.title = title;
    setMeta(`description`, desc);
    setMeta(`og:title`, name, `property`);
    setMeta(`og:description`, desc, `property`);
    if (img) setMeta(`og:image`, img, `property`);
    setMeta(`og:type`, `product`, `property`);
    setMeta(`og:url`, url, `property`);
    setMeta(`og:locale`, ogLocale(lang), `property`);
    setMeta(`twitter:card`, `summary_large_image`);
    setMeta(`twitter:title`, name);
    setMeta(`twitter:description`, desc);
    if (img) setMeta(`twitter:image`, img);
    setCanonical(url);
    setHreflang(url);
    removeJsonLd(`blog-article-ld`); // never both at once
    // Price span across this breed's purchasable products (shirt + mug), so the
    // Product rich result can show a price. Pet-name (+₪20) is an optional add-on
    // and intentionally excluded from the base offer range.
    const offerPrices = [design.price_shirt_basic, design.price_shirt_oversized, design.price_shirt, design.price_mug]
      .map((p) => Number(p))
      .filter((p) => Number.isFinite(p) && p > 0);
    const ld = {
      "@context": `https://schema.org`,
      "@type": `Product`,
      "name": name,
      "image": img ? [img] : undefined,
      "description": desc,
      "inLanguage": lang,
      "brand": { "@type": `Brand`, "name": `BLOOM / Sfalim Shop` },
      "category": design.species === `cat` ? `Cat portrait apparel & gifts` : `Dog portrait apparel & gifts`,
      "url": url,
      "offers": offerPrices.length ? {
        "@type": `AggregateOffer`,
        "priceCurrency": `ILS`,
        "lowPrice": Math.min(...offerPrices),
        "highPrice": Math.max(...offerPrices),
        "availability": `https://schema.org/InStock`,
      } : undefined,
    };
    injectJsonLd(ld, `breed-product-ld`);
  }, [design, lang]);

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: `100vh`, paddingTop: 72, display: `flex`, alignItems: `center`, justifyContent: `center` }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: `50%`, animation: `breedSpin 0.8s linear infinite` }} />
        <style>{`@keyframes breedSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (loadError) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 120, direction: isRTL ? `rtl` : `ltr` }}>
        <LoadError lang={lang} onRetry={() => setReloadKey(k => k + 1)} />
      </div>
    );
  }
  if (notFound || !design) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 120, textAlign: `center`, direction: isRTL ? `rtl` : `ltr`, padding: `120px 20px` }}>
        <div style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontSize: 28, marginBottom: 20 }}>{tt.notFound}</div>
        <button onClick={() => setPage(`pets`)} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 10, padding: `12px 26px`, fontSize: 15, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer` }}>{tt.back}</button>
      </div>
    );
  }

  const name = design[`name_${lang}`] || design.name_en || design.name_he || ``;
  const animal = design[`animal_${lang}`] || design.animal_en || ``;
  const tagline = design[`tagline_${lang}`] || design.tagline_en || ``;

  const shirtProductId = shirtType === `oversized` ? `oversized` : `tshirt`;
  const shirtPrice = shirtType === `oversized`
    ? (Number(design.price_shirt_oversized) || Number(design.price_shirt) || 0)
    : (Number(design.price_shirt_basic) || Number(design.price_shirt) || 0);

  // Personalization: +₪20 per item when (and only when) a pet name is entered,
  // folded into the price passed to onOrderBloom so it threads into the cart line.
  // The name + chosen font/color also ride the cart line into the order.
  const petTrim = petName.trim();
  const petSurcharge = petTrim ? PET_NAME_SURCHARGE : 0;
  const personalization = {
    petName: petTrim || null,
    petNameFont: petTrim ? petNameFont : null,
    petNameColor: petTrim ? petNameColor : null,
  };

  // Add this BLOOM character to the shared cart. Identical payload shape to
  // PetModal.handleOrder — the cart logic itself lives in addBloomToCart.
  const handleOrder = (kind) => {
    if (!design.design_url) return;
    const mockupUrl =
      kind === `mug` ? (design.mockup_mug_url || design.mockup_url || design.design_url) :
      kind === `shirt` ? (
        (selectedColor?.id === `black` ? design.mockup_shirt_black_url : design.mockup_shirt_white_url) ||
        design.mockup_shirt_url || design.mockup_url || design.design_url
      ) :
      (design.mockup_url || design.design_url);
    if (kind === `shirt`) {
      onOrderBloom({ productId: shirtProductId, variantId: shirtSize, price: (Number(shirtPrice) || 0) + petSurcharge, designUrl: design.design_url, mockupUrl, characterName: name, shirtColor: selectedColor, ...personalization });
      return;
    }
    onOrderBloom({ productId: `mug`, price: (Number(design.price_mug) || 0) + petSurcharge, designUrl: design.design_url, mockupUrl, characterName: name, shirtColor: null, ...personalization });
  };

  const shareUrl = `https://www.sfalimshop.com/p/${design.slug}`;
  const handleShare = async () => {
    const heName = design.name_he || design.name_en || name;
    const shareText = `תראו את "${heName}" 🐾 מבית BLOOM של ספלים שופ`;
    if (typeof navigator !== `undefined` && typeof navigator.share === `function`) {
      try { await navigator.share({ title: `BLOOM · ${heName}`, text: shareText, url: shareUrl }); return; }
      catch (err) { if (err && err.name === `AbortError`) return; }
    }
    try { if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl); } catch {}
    if (typeof onShareToast === `function`) {
      onShareToast(tt.copied, { label: tt.whatsapp, handler: () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, `_blank`, `noopener,noreferrer`) });
    }
  };

  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 72, direction: isRTL ? `rtl` : `ltr` }}>
      <div style={{ maxWidth: 1100, margin: `0 auto`, padding: isMobile ? `20px 16px 80px` : `36px 24px 110px`, position: `relative`, zIndex: 1 }}>

        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" style={{ display: `flex`, flexWrap: `wrap`, gap: 8, alignItems: `center`, color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, marginBottom: 24 }}>
          <button onClick={() => setPage(`home`)} style={{ background: `none`, border: `none`, color: COLORS.gray, cursor: `pointer`, fontFamily: `inherit`, fontSize: `inherit`, padding: 0 }}>{tt.home}</button>
          <span aria-hidden="true">/</span>
          <button onClick={() => setPage(`pets`)} style={{ background: `none`, border: `none`, color: COLORS.accent, cursor: `pointer`, fontFamily: `inherit`, fontSize: `inherit`, padding: 0 }}>{tt.collection}</button>
          <span aria-hidden="true">/</span>
          <span style={{ color: COLORS.white, overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap`, maxWidth: 220 }}>{name}</span>
        </nav>

        {/* Hero: image + info */}
        <div style={{ display: `grid`, gridTemplateColumns: isMobile ? `1fr` : `1fr 1fr`, gap: isMobile ? 24 : 40, alignItems: `start` }}>

          {/* Image — shared in-place view carousel (side arrows / counter /
              enlarge / swipe / ←/→). Floats the portrait on the page bg (no
              panel). Same component the modal uses, so they never drift. */}
          <div>
            <BloomImageCarousel
              design={design} lang={lang} isMobile={isMobile}
              previewProduct={previewProduct} setPreviewProduct={setPreviewProduct}
              selectedColor={selectedColor} setSelectedColor={setSelectedColor}
              zoomed={zoomed} setZoomed={setZoomed}
            />
            {/* Live pet-name preview, directly under the design image. */}
            <PetNamePreview name={petName} font={petNameFont} color={petNameColor} />
          </div>

          {/* Info */}
          <div style={{ display: `flex`, flexDirection: `column` }}>
            <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, gap: 12, marginBottom: 12 }}>
              <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 10, letterSpacing: "2px", textTransform: "uppercase" }}>
                {`BLOOM ${LANGS[lang].bloom.collection}`}
              </div>
              <div style={{ display: `flex`, alignItems: `center`, gap: 8 }}>
                <FavHeart slug={design.slug} name={name} lang={lang} size={36} />
                <button type="button" onClick={handleShare} aria-label={tt.share} title={tt.share}
                  style={{ display: `inline-flex`, alignItems: `center`, gap: 6, background: `transparent`, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 20, padding: `6px 14px`, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, fontWeight: 600, cursor: `pointer` }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.color = COLORS.accent; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.white; }}>
                  <span aria-hidden="true">↗</span><span>{tt.share}</span>
                </button>
              </div>
            </div>

            <h1 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 900, fontSize: isMobile ? "2.6rem" : "3.6rem", color: COLORS.white, margin: "0 0 4px 0", lineHeight: 1, letterSpacing: "-0.02em" }}>{name}</h1>

            {animal && <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>{animal}</div>}
            {tagline && <div style={{ color: COLORS.accent, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 400, fontSize: isMobile ? 18 : 22, marginBottom: 24 }}>— {tagline}</div>}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ width: 30, height: 1, background: COLORS.accent }} />
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
            </div>

            {/* Buy / preview-mode CTA */}
            {preview ? (
              <div style={{ marginBottom: 24 }}>
                <JoinBloomCTA lang={lang} source="breed" breedInterest={design.slug} breedName={name} variant="breed" />
              </div>
            ) : (
              <>
                <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14 }}>{tt.available}</div>
                {/* Optional pet-name personalization (Task 8) — same component
                    and cart path as the modal. */}
                <PetNameInput lang={lang} t={tt} value={petName} onChange={setPetName} font={petNameFont} onFont={setPetNameFont} color={petNameColor} onColor={setPetNameColor} />
                {previewProduct === `shirt` && (
                  <BloomShirtOptions
                    lang={lang}
                    selectedColor={selectedColor} setSelectedColor={setSelectedColor}
                    shirtType={shirtType} setShirtType={setShirtType}
                    shirtSize={shirtSize} setShirtSize={setShirtSize}
                    onColorPreview={() => setPreviewProduct(`shirt`)}
                  />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  <ProductOption label={tt.shirt} price={shirtPrice} onClick={() => setPreviewProduct(`shirt`)} disabled={!design.design_url} selected={previewProduct === `shirt`} />
                  <ProductOption label={tt.mug} price={design.price_mug} onClick={() => setPreviewProduct(`mug`)} disabled={!design.design_url} selected={previewProduct === `mug`} />
                </div>
                {previewProduct && (
                  <button
                    onClick={() => handleOrder(previewProduct)}
                    disabled={!design.design_url}
                    onMouseOver={e => { if (design.design_url) e.currentTarget.style.background = COLORS.accentBtnHover; }}
                    onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; }}
                    style={{ width: "100%", background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 10, padding: "16px 20px", marginBottom: 16, cursor: design.design_url ? "pointer" : "not-allowed", opacity: design.design_url ? 1 : 0.5, fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}>
                    🛒 {tt.addToCart} · ₪{(previewProduct === `mug` ? Number(design.price_mug) : Number(shirtPrice)) + petSurcharge}
                  </button>
                )}
                <div style={{ display: `flex`, alignItems: `center`, gap: 10, marginBottom: 24, padding: `10px 12px`, background: `rgba(255,107,53,0.06)`, border: `1px solid rgba(255,107,53,0.18)`, borderRadius: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: `50%`, background: COLORS.accent, flexShrink: 0 }} />
                  <div style={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
                    <span style={{ color: COLORS.accent, fontSize: 12, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, letterSpacing: `0.04em` }}>{tt.made}</span>
                    <span style={{ color: COLORS.gray, fontSize: 11, fontFamily: `'Varela Round',sans-serif` }}>{tt.dispatch}</span>
                  </div>
                </div>
              </>
            )}

            {/* About the breed (shared with PetModal) */}
            <BreedStoryCard design={design} lang={lang} />
          </div>
        </div>

        {/* The whole BLOOM roster — a gentle infinite marquee (replaces the old
            static same-species grid). All 70 float past; hover/touch pauses;
            draggable; click → that breed's page. */}
        <BloomCharacterRail characters={related} lang={lang} goToBreed={goToBreed} isMobile={isMobile} heading={tt.railTitle} />

        {/* Back to collection */}
        <div style={{ marginTop: 48 }}>
          <button onClick={() => setPage(`pets`)} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 10, padding: `12px 24px`, fontSize: 14, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer` }}>{isRTL ? `${tt.back} ←` : `← ${tt.back}`}</button>
        </div>
      </div>
    </div>
  );
}

function MaintenancePage({ lang, setLang, setPage, onUnlock }) {
  const messages = {
    he: { title: "האתר בתחזוקה", sub: "החנות נפתחת בקרוב — אבל אוסף BLOOM כבר כאן. מצאו את הגזע שלכם.", back: "נחזור בקרוב!", staff: "כניסת צוות", explore: "גלו את אוסף BLOOM", pwPlaceholder: "סיסמת צוות", pwGo: "כניסה", pwErr: "סיסמה שגויה" },
    en: { title: "Under Maintenance", sub: "The shop opens soon — but the BLOOM collection is already here. Find your breed.", back: "Back soon!", staff: "Staff login", explore: "Explore the BLOOM collection", pwPlaceholder: "Staff password", pwGo: "Enter", pwErr: "Wrong password" },
    ru: { title: "Сайт на обслуживании", sub: "Магазин скоро откроется — но коллекция BLOOM уже здесь. Найдите свою породу.", back: "Скоро вернёмся!", staff: "Вход для персонала", explore: "Открыть коллекцию BLOOM", pwPlaceholder: "Пароль персонала", pwGo: "Войти", pwErr: "Неверный пароль" },
  };
  const m = messages[lang] || messages.he;

  // 🔐 Staff password gate. A bare ?staff=1 only auto-opens this field; it does
  // NOT bypass on its own. Correct password (VITE_STAFF_PASSWORD) → sessionStorage
  // flag + onUnlock() so the App re-renders past the maintenance gate for this
  // session. SOFT client-side gate by design (the Vite env value is in the
  // bundle) — enough to keep casual visitors out, not real auth. If the env var
  // is unset/empty the gate stays CLOSED (expected is falsy → never matches).
  const staffParam = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("staff") === "1";
  const [showStaff, setShowStaff] = useState(staffParam);
  const [pwd, setPwd] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const expectedPw = import.meta.env.VITE_STAFF_PASSWORD;
  const submitStaff = () => {
    if (expectedPw && pwd === expectedPw) {
      window.sessionStorage.setItem("sf_staff", "1");
      onUnlock && onUnlock();
    } else {
      setPwErr(true);
    }
  };
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, zIndex: 10, direction: lang === "he" ? "rtl" : "ltr" }}>
      <div style={{ position: "absolute", top: 20, insetInlineEnd: 20, display: "flex", gap: 8 }}>
        {["he", "en", "ru"].map(l => (
          <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ background: lang === l ? "#C0501A" : "transparent", border: `1px solid ${lang === l ? "#FF6B35" : "#333"}`, color: lang === l ? "#fff" : "#999", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif" }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#FF6B35", display: "inline-block", boxShadow: "0 0 30px rgba(255,107,53,0.7)", animation: "maintPulse 2s ease-in-out infinite" }}></span>
        </div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 48, color: "#fff", marginBottom: 16, letterSpacing: "-0.5px" }}>{m.title}</h1>
        <p style={{ color: "#999", fontSize: 18, marginBottom: 8, fontFamily: "'Varela Round',sans-serif" }}>{m.sub}</p>
        <p style={{ color: "#FF6B35", fontSize: 16, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", marginBottom: 28 }}>{m.back}</p>
        {/* Public entry into the pre-launch BLOOM "Find Your Breed" preview. */}
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => setPage("pets")} style={{ background: COLORS.accentBtn, color: "#fff", border: "none", borderRadius: 10, padding: "15px 32px", fontSize: 15, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", cursor: "pointer", boxShadow: "0 8px 28px rgba(255,107,53,0.35)", transition: "background 0.2s, transform 0.2s" }}
            onMouseOver={e => { e.currentTarget.style.background = COLORS.accentBtnHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseOut={e => { e.currentTarget.style.background = COLORS.accentBtn; e.currentTarget.style.transform = "translateY(0)"; }}>
            {m.explore}
          </button>
        </div>
        <a href={SOCIAL.instagram} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF, #515BD4)", color: "#fff", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontFamily: "'Varela Round',sans-serif", fontWeight: 600, fontSize: 14 }}>
          Instagram @sfalimshop
        </a>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 36, opacity: 0.85 }}>
          <div style={{ width: 22, height: 1, background: "rgba(255,107,53,0.4)" }}></div>
          <div style={{ width: 4, height: 4, background: "rgba(255,107,53,0.6)", borderRadius: "50%" }}></div>
          <div style={{ width: 22, height: 1, background: "rgba(255,107,53,0.4)" }}></div>
        </div>
        <div style={{
          marginTop: 14,
          color: "#888",
          fontFamily: lang === "he" ? "'Heebo',sans-serif" : "'Playfair Display',serif",
          fontStyle: lang === "he" ? "normal" : "italic",
          fontWeight: 400,
          fontSize: 14,
          letterSpacing: lang === "he" ? "0.04em" : "0.02em"
        }}>{BUSINESS_INFO.tagline[lang]}</div>
      </div>
      <div style={{ position: "absolute", bottom: 56, fontSize: 12, color: "#8a8a8a", fontFamily: "'Varela Round',sans-serif", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
        <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "פרטיות" : lang === "ru" ? "Конфиденциальность" : "Privacy Policy"}
        </a>
        <span style={{ color: "#808080" }}>·</span>
        <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "תקנון" : lang === "ru" ? "Условия" : "Terms of Service"}
        </a>
        <span style={{ color: "#808080" }}>·</span>
        <a href="/accessibility" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "נגישות" : lang === "ru" ? "Доступность" : "Accessibility"}
        </a>
        <span style={{ color: "#808080" }}>·</span>
        <a href="mailto:hello@sfalimshop.com" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "צור קשר" : lang === "ru" ? "Контакты" : "Contact"}
        </a>
      </div>
      <div style={{ position: "absolute", bottom: 20, fontSize: 11, color: "#8a8a8a", fontFamily: "'Varela Round',sans-serif", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {!showStaff ? (
          <button onClick={() => setShowStaff(true)} style={{ background: "none", border: "none", color: "#8a8a8a", cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif", padding: 4 }}>· {m.staff} ·</button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, direction: lang === "he" ? "rtl" : "ltr" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="password"
                value={pwd}
                autoFocus
                onChange={e => { setPwd(e.target.value); if (pwErr) setPwErr(false); }}
                onKeyDown={e => { if (e.key === "Enter") submitStaff(); }}
                placeholder={m.pwPlaceholder}
                aria-label={m.pwPlaceholder}
                style={{ background: "#181818", border: `1px solid ${pwErr ? "#a33" : "#333"}`, borderRadius: 8, color: "#ddd", padding: "8px 12px", fontSize: 13, fontFamily: "'Varela Round',sans-serif", width: 170, outline: "none" }} />
              <button onClick={submitStaff} style={{ background: COLORS.accentBtn, border: "none", borderRadius: 8, color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", cursor: "pointer" }}>{m.pwGo}</button>
            </div>
            {pwErr && <span style={{ color: "#e06a5a", fontSize: 11 }}>{m.pwErr}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function PoliciesPage({ lang }) {
  const PATH_TO_SECTION = {
    '/privacy': 'privacy',
    '/terms': 'terms',
    '/refunds': 'refund',
    '/shipping': 'shipping',
    '/accessibility': 'accessibility',
  };
  const sectionFromURL = (() => {
    if (typeof window === "undefined") return "refund";
    if (PATH_TO_SECTION[window.location.pathname]) return PATH_TO_SECTION[window.location.pathname];
    return (rawHash().split("?")[0].replace("#", "") || "").split("/")[1] || "refund";
  })();
  const [activeSection, setActiveSection] = useState(sectionFromURL);
  const content = POLICIES[lang] || POLICIES.he;
  const isRTL = lang === "he";

  useEffect(() => {
    const onHashChange = () => {
      const s = (rawHash().replace("#", "") || "").split("/")[1] || "refund";
      setActiveSection(s);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goSection = (id) => {
    setActiveSection(id);
    window.location.hash = `policies/${id}`;
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px", direction: isRTL ? "rtl" : "ltr", position: "relative", zIndex: 5 }}>
      <h1 className="reveal" style={{ color: "#fff", fontFamily: "'Playfair Display',serif", fontSize: 42, marginBottom: 8 }}>
        {lang === "he" ? "מדיניות ותקנון" : lang === "ru" ? "Политика и условия" : "Policies & Terms"}
      </h1>
      <p className="reveal" data-delay="1" style={{ color: "#999", fontSize: 15, marginBottom: 32, fontFamily: "'Varela Round',sans-serif" }}>
        {BUSINESS_INFO.name[lang]}
      </p>

      <div className="reveal" data-delay="2" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
        {POLICY_SECTIONS.map(s => (
          <button key={s.id} onClick={() => goSection(s.id)} style={{ background: activeSection === s.id ? "#FF6B35" : "#1a1a1a", color: activeSection === s.id ? "#fff" : "#999", border: `1px solid ${activeSection === s.id ? "#FF6B35" : "#333"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 600 }}>
            {s.title[lang]}
          </button>
        ))}
      </div>

      <div className="reveal" data-delay="3" style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: "32px 28px" }}>
        <h2 style={{ color: "#fff", fontFamily: "'Playfair Display',serif", fontSize: 28, marginBottom: 20, borderBottom: "1px solid #333", paddingBottom: 12 }}>
          {POLICY_SECTIONS.find(s => s.id === activeSection)?.title[lang]}
        </h2>
        <div style={{ color: "#ccc", fontFamily: "'Varela Round',sans-serif", fontSize: 14, lineHeight: 1.8 }}>
          {(content[activeSection] || []).map((block, i) => {
            if (block.type === "h") return <h3 key={i} style={{ color: "#FF6B35", fontSize: 17, marginTop: 24, marginBottom: 10, fontWeight: 700 }}>{block.text}</h3>;
            if (block.type === "p") return <p key={i} style={{ marginBottom: 12 }}>{block.text}</p>;
            if (block.type === "l") return (
              <ul key={i} style={{ marginBottom: 12, paddingInlineStart: 20 }}>
                {block.items.map((item, j) => <li key={j} style={{ marginBottom: 6 }}>{item}</li>)}
              </ul>
            );
            return null;
          })}
        </div>
      </div>

      <div style={{ background: "rgba(255,107,53,0.08)", border: "1px solid #FF6B35", borderRadius: 12, padding: "16px 20px", marginTop: 24, color: "#ccc", fontFamily: "'Varela Round',sans-serif", fontSize: 13 }}>
        <div style={{ color: "#FF6B35", fontWeight: 700, marginBottom: 6, letterSpacing: "0.05em" }}>
          {lang === "he" ? "צריכים עזרה?" : lang === "ru" ? "Нужна помощь?" : "Need help?"}
        </div>
        <div><a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "#ccc", textDecoration: "none" }}>{BUSINESS_INFO.email}</a> · <a href={`tel:${BUSINESS_INFO.phoneIntl}`} style={{ color: "#ccc", textDecoration: "none" }}>{BUSINESS_INFO.phone}</a></div>
        <div style={{ marginTop: 4 }}>{BUSINESS_INFO.address[lang]}</div>
      </div>
    </div>
  );
}

function Footer({ lang, setPage }) {
  const isRTL = lang === "he";
  const goPolicy = (sectionId) => {
    window.location.hash = `policies/${sectionId}`;
    setPage("policies");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goFaq = () => {
    setPage("faq");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <footer style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "48px 24px 24px", marginTop: 60, direction: isRTL ? "rtl" : "ltr", position: "relative", zIndex: 5 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40 }}>
        <div className="reveal" data-delay="1">
          <div style={{ color: "#FF6B35", fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "0.3px" }}>{BUSINESS_INFO.name[lang]}</div>
          <div style={{ color: "#a8a8a8", fontFamily: lang === "he" ? "'Heebo',sans-serif" : "'Playfair Display',serif", fontStyle: lang === "he" ? "normal" : "italic", fontWeight: 400, fontSize: 13, letterSpacing: lang === "he" ? "0.04em" : "0.02em", marginBottom: 14 }}>{BUSINESS_INFO.tagline[lang]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
            <div style={{ width: 18, height: 2, background: "rgba(255,107,53,0.5)", borderRadius: 2 }}></div>
            <div style={{ width: 4, height: 4, background: "rgba(255,107,53,0.7)", borderRadius: "50%" }}></div>
            <div style={{ width: 18, height: 2, background: "rgba(255,107,53,0.5)", borderRadius: 2 }}></div>
          </div>
          <div style={{ color: "#888", fontSize: 13, fontFamily: "'Varela Round',sans-serif", lineHeight: 1.9 }}>
            <div style={{ marginBottom: 4 }}>{BUSINESS_INFO.address[lang]}</div>
            <div style={{ marginBottom: 4 }}>
              <a href={`tel:${BUSINESS_INFO.phoneIntl}`} className="footer-contact-link" style={{ color: "#888" }}>{BUSINESS_INFO.phone}</a>
            </div>
            <div>
              <a href={`mailto:${BUSINESS_INFO.email}`} className="footer-contact-link" style={{ color: "#888" }}>{BUSINESS_INFO.email}</a>
            </div>
            <div style={{ marginTop: 12, color: "#b0b0b0", fontSize: 11, letterSpacing: "0.03em" }}>{lang === "he" ? "עוסק פטור מס׳" : lang === "ru" ? "Освобождённый предприниматель №" : "Exempt Dealer No."} {BUSINESS_INFO.vatId}</div>
          </div>
        </div>
        <div className="reveal" data-delay="2">
          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Varela Round',sans-serif" }}>
            {lang === "he" ? "מידע משפטי" : lang === "ru" ? "Юр. информация" : "Legal"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {POLICY_SECTIONS.map(s => (
              <button key={s.id} onClick={() => goPolicy(s.id)} className="footer-link" style={{ textAlign: "start" }}>
                {s.title[lang]}
              </button>
            ))}
          </div>
        </div>
        <div className="reveal" data-delay="3">
          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Varela Round',sans-serif" }}>
            {lang === "he" ? "עזרה" : lang === "ru" ? "Помощь" : "Help"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={goFaq} className="footer-link" style={{ textAlign: "start" }}>
              {lang === "he" ? "שאלות נפוצות" : lang === "ru" ? "Частые вопросы" : "FAQ"}
            </button>
          </div>
        </div>
        <div className="reveal" data-delay="4">
          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Varela Round',sans-serif" }}>
            {lang === "he" ? "עקבו אחרינו" : lang === "ru" ? "Соцсети" : "Follow Us"}
          </div>
          <a href={SOCIAL.instagram} target="_blank" rel="noopener" className="footer-contact-link" style={{ display: "inline-block", color: "#888", fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 500, letterSpacing: "0.3px" }}>
            Instagram <span style={{ color: "#8a8a8a" }}>· @sfalimshop</span>
          </a>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "40px auto 0", paddingTop: 22, borderTop: "1px solid #1a1a1a", color: "#808080", fontSize: 11, fontFamily: "'Varela Round',sans-serif", textAlign: "center", letterSpacing: "0.05em" }}>
        © {new Date().getFullYear()} {BUSINESS_INFO.name[lang]} · {lang === "he" ? "כל הזכויות שמורות" : lang === "ru" ? "Все права защищены" : "All rights reserved"}
      </div>
    </footer>
  );
}

// ============================================================================
// FAQ — #faq route. Accordion grouped under section headings, fully trilingual
// (Hebrew is the source of truth; en/ru translated from it). Owns its own SEO:
// title + description + FAQPage JSON-LD (id `faq-ld`), cleaned up on unmount and
// by setGenericSeo so it never leaks onto other routes. The payment-methods Q&A
// is gated behind PAYMENTS_ENABLED for BOTH the UI and the JSON-LD.
// All strings via template literals — never `+` concatenation. No emoji.
// ============================================================================

const FAQ_GROUPS = [
  {
    id: `shipping`,
    title: { he: `משלוח ואספקה`, en: `Shipping & Delivery`, ru: `Доставка` },
    items: [
      {
        q: { he: `כמה זמן לוקח לקבל את ההזמנה?`, en: `How long does it take to get my order?`, ru: `Сколько времени занимает получение заказа?` },
        a: {
          he: `כל פריט מודפס במיוחד עבורכם, אז אנחנו מכינים ושולחים תוך 2–4 ימי עסקים. המשלוח מגיע עם UPS תוך 2–4 ימי עסקים נוספים — סה״כ כ-4–8 ימי עסקים מההזמנה ועד הדלת, עם מספר מעקב.`,
          en: `Every item is printed especially for you, so we prepare and ship within 2–4 business days. Delivery is by UPS within another 2–4 business days — about 4–8 business days in total from order to doorstep, with a tracking number.`,
          ru: `Каждое изделие печатается специально для вас, поэтому мы изготавливаем и отправляем его в течение 2–4 рабочих дней. Доставка осуществляется службой UPS ещё за 2–4 рабочих дня — всего около 4–8 рабочих дней от заказа до двери, с номером для отслеживания.`,
        },
      },
      {
        q: { he: `כמה עולה המשלוח? יש איסוף עצמי?`, en: `How much is shipping? Is local pickup available?`, ru: `Сколько стоит доставка? Есть ли самовывоз?` },
        a: {
          he: `אנחנו שולחים לכל הארץ עם UPS. לתושבי באר שבע — משלוח חינם לרגל הפתיחה! ניתן גם לתאם איסוף עצמי מבאר שבע, חינם, בתיאום מראש. עלות המשלוח לשאר הארץ מתעדכנת בקופה.`,
          en: `We ship throughout Israel with UPS. For Be'er Sheva residents — free shipping to celebrate our opening! You can also arrange free local pickup in Be'er Sheva, by prior coordination. Shipping cost for the rest of the country is shown at checkout.`,
          ru: `Мы доставляем по всему Израилю службой UPS. Для жителей Беэр-Шевы — бесплатная доставка в честь открытия! Также можно договориться о бесплатном самовывозе в Беэр-Шеве по предварительной координации. Стоимость доставки в остальные районы страны указывается на кассе.`,
        },
      },
    ],
  },
  {
    id: `custom`,
    title: { he: `עיצוב אישי (מתמונה שלכם)`, en: `Custom Design (From Your Photo)`, ru: `Индивидуальный дизайн (по вашему фото)` },
    items: [
      {
        q: { he: `איך מזמינים מוצר עם תמונה של החיה שלי?`, en: `How do I order a product with a photo of my pet?`, ru: `Как заказать товар с фотографией моего питомца?` },
        a: {
          he: `בוחרים מוצר, מעלים תמונה, ואנחנו מעצבים אותה בסגנון BLOOM. לפני שאתם משלמים — אנחנו שולחים לכם את העיצוב לאישור. רק כשאתם מרוצים ומאשרים, עוברים לתשלום והפקה.`,
          en: `Choose a product, upload a photo, and we'll design it in the BLOOM style. Before you pay, we send you the design for approval. Only once you're happy and approve it do we move on to payment and production.`,
          ru: `Выберите товар, загрузите фотографию, и мы оформим её в стиле BLOOM. Перед оплатой мы пришлём вам дизайн на утверждение. Только когда вы довольны и подтверждаете его, мы переходим к оплате и производству.`,
        },
      },
      {
        q: { he: `אילו תמונות הכי מתאימות?`, en: `Which photos work best?`, ru: `Какие фотографии подходят лучше всего?` },
        a: {
          he: `תמונה חדה, בתאורה טובה (אור יום מצוין), עם פרצוף ברור וממורכז. ככל שהתמונה איכותית יותר — העיצוב יוצא טוב יותר.`,
          en: `A sharp photo in good lighting (daylight is excellent), with a clear, centered face. The better the photo's quality, the better the design comes out.`,
          ru: `Чёткая фотография при хорошем освещении (дневной свет — отлично), с ясной и расположенной по центру мордочкой. Чем выше качество фотографии, тем лучше получается дизайн.`,
        },
      },
      {
        q: { he: `ומה אם לא אהבתי את העיצוב?`, en: `What if I don't like the design?`, ru: `А что, если мне не понравился дизайн?` },
        a: {
          he: `אין בעיה — לפני התשלום אפשר לבקש תיקונים, ונשפר עד שתהיו מרוצים. רק לאחר אישור עוברים לתשלום.`,
          en: `No problem — before payment you can request changes, and we'll refine it until you're happy. Only after your approval do we proceed to payment.`,
          ru: `Не проблема — до оплаты вы можете попросить правки, и мы будем дорабатывать его, пока вы не останетесь довольны. К оплате переходим только после вашего одобрения.`,
        },
      },
    ],
  },
  {
    id: `products`,
    title: { he: `מוצרים ואיכות`, en: `Products & Quality`, ru: `Товары и качество` },
    items: [
      {
        q: { he: `מאיזה חומר המוצרים? ההדפסה מחזיקה בכביסה?`, en: `What are the products made of? Will the print survive washing?`, ru: `Из чего сделаны товары? Сохранится ли печать после стирки?` },
        a: {
          he: `הספלים קרמיים. רוב החולצות (טי בייסיק, אוברסייז, סטון ווש) הן 100% כותנה סרוקה, והדרייפיט הוא פוליאסטר טכני נושם (לא כותנה). כדי שההדפסה תישמר לאורך זמן: את הספל מומלץ לשטוף ביד; את החולצה לכבס בהיפוך, במים קרים, ולייבוש עדין.`,
          en: `The mugs are ceramic. Most shirts (Tee Basic, Oversize, Stone-wash) are 100% combed cotton, while the Dri-FIT is a breathable technical polyester (not cotton). To keep the print looking great over time: hand-wash the mug; wash the shirt inside-out, in cold water, and dry gently.`,
          ru: `Кружки керамические. Большинство футболок (Tee Basic, Oversize, Stone-wash) — 100% чёсаный хлопок, а Dri-FIT — дышащий технический полиэстер (не хлопок). Чтобы печать держалась долго: кружку мыть вручную; футболку стирать наизнанку, в холодной воде и сушить бережно.`,
        },
      },
      {
        q: { he: `אילו מידות חולצות יש?`, en: `What shirt sizes are available?`, ru: `Какие размеры футболок есть?` },
        a: {
          he: `מגוון מידות מ-S ועד XXL.`,
          en: `A range of sizes from S to XXL.`,
          ru: `Размеры в диапазоне от S до XXL.`,
        },
      },
      {
        q: { he: `מאיזה בד החולצות שלכם?`, en: `What fabric are your shirts made of?`, ru: `Из какой ткани ваши футболки?` },
        a: {
          he: `רוב החולצות שלנו עשויות 100% כותנה סרוקה — סיב איכותי ונעים. טי בייסיק — גזרה קלאסית; אוברסייז — גזרה רחבה; סטון ווש — אוברסייז עם גימור כביסת סטון-ווש למראה דהוי/וינטג'. חולצת הדרייפיט שונה: בד פוליאסטר טכני נושם שמנדף זיעה, מתאים לפעילות וספורט. מילון: כותנה סרוקה = כותנה שעברה סירוק להסרת סיבים קצרים (חלקה, חזקה ונעימה יותר); סטון ווש = כביסה שמרככת ונותנת מראה וינטג' דהוי; דרייפיט = בד טכני נושם שמנדף זיעה, שונה מכותנה.`,
          en: `Most of our shirts are 100% combed cotton — a soft, high-quality fiber. Tee Basic — classic fit; Oversize — relaxed fit; Stone-wash — oversize with a stone-wash finish for a faded vintage look. The Dri-FIT shirt is different: a breathable technical polyester that wicks sweat, made for activity and sport. Glossary: Combed cotton = cotton brushed to remove short fibers (smoother, stronger, softer); Stone-wash = a wash that softens the fabric and gives a faded vintage look; Dri-FIT = a breathable technical fabric that wicks sweat, different from cotton.`,
          ru: `Большинство наших футболок — 100% чёсаный хлопок, мягкое качественное волокно. Tee Basic — классический крой; Oversize — свободный крой; Stone-wash — оверсайз с отделкой стоунвош для выцветшего винтажного вида. Футболка Dri-FIT отличается: дышащий технический полиэстер, отводит влагу, для активности и спорта. Словарь: чёсаный хлопок = хлопок без коротких волокон (глаже, прочнее, мягче); стоунвош = стирка для мягкости и винтажного вида; Dri-FIT = дышащая техническая ткань, отводит влагу, отличается от хлопка.`,
        },
      },
    ],
  },
  {
    id: `payment`,
    title: { he: `תשלום, ביטולים והחזרות`, en: `Payment, Cancellations & Returns`, ru: `Оплата, отмена и возврат` },
    items: [
      {
        q: { he: `מה מדיניות הביטולים וההחזרות?`, en: `What is your cancellation and return policy?`, ru: `Какова политика отмены и возврата?` },
        a: {
          he: `מוצרי BLOOM רגילים ניתנים לביטול/החזרה בהתאם לחוק הגנת הצרכן. מוצרים בעיצוב אישי (תמונה שלכם) מיוצרים במיוחד עבורכם ולכן אינם ניתנים להחזרה — אלא במקרה של פגם בהדפסה, שאותו נתקן או נחליף.`,
          en: `Standard BLOOM products can be cancelled/returned in accordance with the Israeli Consumer Protection Law. Custom-design products (made from your photo) are produced especially for you and therefore cannot be returned — except in the case of a printing defect, which we will fix or replace.`,
          ru: `Стандартные товары BLOOM можно отменить/вернуть в соответствии с израильским Законом о защите прав потребителей. Товары с индивидуальным дизайном (по вашему фото) изготавливаются специально для вас и поэтому возврату не подлежат — за исключением случая дефекта печати, который мы исправим или заменим.`,
        },
      },
      {
        // Gated: rendered (UI + JSON-LD) only while PAYMENTS_ENABLED === true.
        paymentOnly: true,
        q: { he: `אילו אמצעי תשלום אתם מקבלים?`, en: `What payment methods do you accept?`, ru: `Какие способы оплаты вы принимаете?` },
        a: {
          he: `תשלום מאובטח בכרטיס אשראי; פרטי הכרטיס אינם נשמרים אצלנו.`,
          en: `Secure payment by credit card; your card details are not stored by us.`,
          ru: `Безопасная оплата кредитной картой; данные вашей карты у нас не хранятся.`,
        },
      },
    ],
  },
  {
    id: `general`,
    title: { he: `כללי`, en: `General`, ru: `Общее` },
    items: [
      {
        q: { he: `איך יוצרים איתכם קשר?`, en: `How can I contact you?`, ru: `Как с вами связаться?` },
        a: {
          he: `במייל hello@sfalimshop.com, בוואטסאפ 050-484-7874, או באינסטגרם @sfalimshop.`,
          en: `By email at hello@sfalimshop.com, on WhatsApp at 050-484-7874, or on Instagram @sfalimshop.`,
          ru: `По электронной почте hello@sfalimshop.com, в WhatsApp 050-484-7874 или в Instagram @sfalimshop.`,
        },
      },
      {
        q: { he: `באילו שפות אפשר להזמין?`, en: `In which languages can I order?`, ru: `На каких языках можно сделать заказ?` },
        a: {
          he: `האתר זמין בעברית, אנגלית ורוסית.`,
          en: `The site is available in Hebrew, English, and Russian.`,
          ru: `Сайт доступен на иврите, английском и русском.`,
        },
      },
      {
        q: { he: `אתם עושים הזמנות קבוצתיות לאירועים?`, en: `Do you do group orders for events?`, ru: `Делаете ли вы групповые заказы для мероприятий?` },
        a: {
          he: `כן! אנחנו מתמחים בחולצות מותאמות לאירועים — מסיבות רווקים/רווקות, חתונות, ימי הולדת, גיבושים וצוותים. אפשר עיצוב אישי, שמות, ומחיר מיוחד להזמנות כמות (5 חולצות ומעלה), עם מבחר צבעים רחב יותר. כתבו לנו בוואטסאפ ונכין לכם הצעת מחיר אישית.`,
          en: `Yes! We specialize in custom shirts for events — bachelor/ette parties, weddings, birthdays, and team/company events. Personalized designs, names, and special pricing for quantity orders (5+ shirts), with a wider color range. Message us on WhatsApp for a personal quote.`,
          ru: `Да! Мы делаем футболки на заказ для мероприятий — девичники/мальчишники, свадьбы, дни рождения, корпоративы. Персональный дизайн, имена и специальные цены на количество (от 5 футболок), с расширенным выбором цветов. Напишите нам в WhatsApp — подготовим индивидуальное предложение.`,
        },
      },
    ],
  },
];

// Per-language FAQ meta description (FAQ-specific; restored to generic on exit).
const FAQ_SEO_DESC = {
  he: `שאלות ותשובות על משלוח, עיצוב אישי מתמונה, מוצרים, החזרות ותשלום בספלים שופ.`,
  en: `Answers about shipping, custom photo designs, products, returns and payment at Sfalim Shop.`,
  ru: `Ответы о доставке, индивидуальном дизайне по фото, товарах, возврате и оплате в Sfalim Shop.`,
};

function FaqAccordionItem({ item, lang, isRTL, idBase }) {
  const [open, setOpen] = useState(false);
  const btnId = `${idBase}-q`;
  const panelId = `${idBase}-a`;
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, marginBottom: 10, overflow: `hidden` }}>
      <h3 style={{ margin: 0 }}>
        <button
          id={btnId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(o => !o)}
          style={{
            width: `100%`, display: `flex`, alignItems: `center`, justifyContent: `space-between`, gap: 14,
            background: `transparent`, border: `none`, cursor: `pointer`,
            padding: `18px 20px`, textAlign: `start`,
            color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 16, fontWeight: 600, lineHeight: 1.4,
          }}>
          <span>{item.q[lang]}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? COLORS.accent : COLORS.gray} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transition: `transform 0.25s ease, stroke 0.2s ease`, transform: open ? `rotate(180deg)` : `rotate(0deg)` }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={btnId} hidden={!open} style={{ padding: `0 20px 18px` }}>
        <p style={{ margin: 0, color: `#d6d6d6`, fontFamily: `'Varela Round',sans-serif`, fontSize: 15, lineHeight: 1.75 }}>{item.a[lang]}</p>
      </div>
    </div>
  );
}

function FaqPage({ lang }) {
  const isRTL = lang === `he`;
  const pageTitle = lang === `he` ? `שאלות נפוצות` : lang === `ru` ? `Частые вопросы` : `Frequently Asked Questions`;
  const intro = lang === `he` ? `כל מה שכדאי לדעת לפני שמזמינים.` : lang === `ru` ? `Всё, что стоит знать перед заказом.` : `Everything worth knowing before you order.`;

  // One filtered list used for BOTH the UI and the JSON-LD — the payment Q&A is
  // dropped from both while payments are off.
  const groups = FAQ_GROUPS
    .map(g => ({ ...g, items: g.items.filter(it => !it.paymentOnly || PAYMENTS_ENABLED) }))
    .filter(g => g.items.length > 0);

  useEffect(() => {
    if (typeof document === `undefined`) return;
    const docTitle = lang === `he` ? `שאלות נפוצות | ספלים שופ` : lang === `ru` ? `Частые вопросы | Sfalim Shop` : `FAQ | Sfalim Shop`;
    const desc = FAQ_SEO_DESC[lang] || FAQ_SEO_DESC.he;
    const url = `${SEO_ORIGIN}/faq`;
    document.title = docTitle;
    setMeta(`description`, desc);
    setMeta(`og:title`, pageTitle, `property`);
    setMeta(`og:description`, desc, `property`);
    setMeta(`og:type`, `website`, `property`);
    setMeta(`og:url`, url, `property`);
    setMeta(`og:locale`, ogLocale(lang), `property`);
    setMeta(`twitter:card`, `summary`);
    setMeta(`twitter:title`, pageTitle);
    setMeta(`twitter:description`, desc);
    setCanonical(url);
    setHreflang(url);
    // Never two dynamic blocks at once (parity with breed/blog).
    removeJsonLd(`breed-product-ld`);
    removeJsonLd(`blog-article-ld`);
    const ld = {
      "@context": `https://schema.org`,
      "@type": `FAQPage`,
      "inLanguage": lang,
      "mainEntity": groups.flatMap(g => g.items).map(it => ({
        "@type": `Question`,
        "name": it.q[lang],
        "acceptedAnswer": { "@type": `Answer`, "text": it.a[lang] },
      })),
    };
    injectJsonLd(ld, `faq-ld`);
    // Drop our JSON-LD when leaving the FAQ (any destination) so it never leaks.
    return () => removeJsonLd(`faq-ld`);
  }, [lang]);

  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 72, direction: isRTL ? `rtl` : `ltr` }}>
      <div style={{ maxWidth: 820, margin: `0 auto`, padding: `48px 22px 100px`, textAlign: isRTL ? `right` : `left` }}>
        <h1 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 900, fontSize: `2.4rem`, lineHeight: 1.15, color: COLORS.white, margin: `0 0 10px`, letterSpacing: `-0.01em` }}>{pageTitle}</h1>
        <p style={{ color: COLORS.grayLight, fontFamily: `'Varela Round',sans-serif`, fontSize: 15, margin: `0 0 40px` }}>{intro}</p>

        {groups.map(g => (
          <section key={g.id} style={{ marginBottom: 36 }}>
            <h2 style={{ color: COLORS.accent, fontFamily: `'IBM Plex Mono','Courier New',monospace`, fontSize: 13, letterSpacing: `1.5px`, textTransform: `uppercase`, margin: `0 0 16px`, fontWeight: 700 }}>{g.title[lang]}</h2>
            {g.items.map((it, i) => (
              <FaqAccordionItem key={`${g.id}-${i}`} item={it} lang={lang} isRTL={isRTL} idBase={`faq-${g.id}-${i}`} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BLOG — index, post, admin + SEO helpers (Slices 1–3)
// ----------------------------------------------------------------------------
// Frontend only. Reads the existing public.blog_posts table (RLS: public reads
// status='published'; admin full access). Cover images live in the public
// blog-images bucket. No view-count RPC is called (intentional). Routing uses
// the canonical #/blog and #/blog/<slug> hashes handled by App's goToBlog.
// All strings via template literals — never `+` concatenation.
// ============================================================================

const BLOG_CATEGORY_IDS = ['breeds', 'gifts', 'culture', 'stories'];
const BLOG_LOGO_URL = `https://www.sfalimshop.com/logo.jpg`; // existing asset (Nav uses /logo.jpg)

function blogCategoryLabel(lang, cat) {
  const t = LANGS[lang] || LANGS.he;
  const map = { breeds: t.blogCategoryBreeds, gifts: t.blogCategoryGifts, culture: t.blogCategoryCulture, stories: t.blogCategoryStories };
  return map[cat] || cat || ``;
}

function formatBlogDate(iso, lang) {
  if (!iso) return ``;
  try {
    const loc = lang === `he` ? `he-IL` : lang === `ru` ? `ru-RU` : `en-US`;
    return new Date(iso).toLocaleDateString(loc, { year: `numeric`, month: `long`, day: `numeric` });
  } catch { return ``; }
}

// Read the blog slug from the current hash (#/blog/<slug>). Hoisted so App's
// useState initializer + popstate handler can call it.
function parseBlogSlugFromHash() {
  if (typeof window === `undefined`) return null;
  const h = rawHash().replace(`#`, ``).replace(/^\//, ``);
  const path = h.split(`?`)[0];
  const parts = path.split(`/`);
  if (parts[0] !== `blog`) return null;
  return parts[1] ? decodeURIComponent(parts[1]) : null;
}

// Breed sub-route slug from the hash. Canonical form is #/breed/<slug>; a
// ?slug= form is also tolerated for symmetry with the /pets deep links.
function parseBreedSlugFromHash() {
  if (typeof window === `undefined`) return null;
  const h = rawHash().replace(`#`, ``).replace(/^\//, ``);
  const path = h.split(`?`)[0];
  const parts = path.split(`/`);
  if (parts[0] !== `breed`) return null;
  const qIdx = h.indexOf(`?`);
  if (qIdx !== -1) {
    const s = new URLSearchParams(h.slice(qIdx + 1)).get(`slug`);
    if (s) return s;
  }
  return parts[1] ? decodeURIComponent(parts[1]) : null;
}

function blogShareUrl(slug) { return `https://www.sfalimshop.com/#/blog/${slug}`; }

// Create or update a <meta> tag in <head> (idempotent — never duplicates on
// re-navigation). attr is 'name' (default) or 'property' for OG tags.
function setMeta(name, content, attr) {
  if (typeof document === `undefined` || content == null) return;
  const a = attr || `name`;
  let el = document.head.querySelector(`meta[${a}="${name}"]`);
  if (!el) { el = document.createElement(`meta`); el.setAttribute(a, name); document.head.appendChild(el); }
  el.setAttribute(`content`, String(content));
}

// Map a UI language to its Open Graph locale code (og:locale). Used so EN/RU
// shares advertise the correct locale instead of the static he_IL from index.html.
function ogLocale(lang) {
  return lang === `en` ? `en_US` : lang === `ru` ? `ru_RU` : `he_IL`;
}

// Create or update a JSON-LD <script> by id (idempotent).
function injectJsonLd(obj, id) {
  if (typeof document === `undefined`) return;
  let el = document.getElementById(id);
  if (!el) { el = document.createElement(`script`); el.type = `application/ld+json`; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}

// Remove a dynamic JSON-LD block by id (used when leaving breed/blog pages so a
// stale Product/Article block never lingers on the next route).
function removeJsonLd(id) {
  if (typeof document === `undefined`) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Canonical domain for SEO URLs (matches index.html). The blog share helper
// above predates this and uses the bare host; new SEO code standardises on www.
const SEO_ORIGIN = `https://www.sfalimshop.com`;
const SITE_OG_IMAGE = `${SEO_ORIGIN}/og-image.png`;

// Upsert <link rel="canonical">.
function setCanonical(url) {
  if (typeof document === `undefined` || !url) return;
  let el = document.head.querySelector(`link[rel="canonical"]`);
  if (!el) { el = document.createElement(`link`); el.setAttribute(`rel`, `canonical`); document.head.appendChild(el); }
  el.setAttribute(`href`, url);
}

// Upsert the he/en/ru/x-default hreflang alternates. This is a hash-router SPA
// with one URL per page (language is in-app state, not the URL), so all four
// alternates point at the same page URL — mirroring the static index.html
// approach. Kept so the cluster is correct once prerender/SSR lands.
function setHreflang(url) {
  if (typeof document === `undefined` || !url) return;
  for (const hl of [`he`, `en`, `ru`, `x-default`]) {
    let el = document.head.querySelector(`link[rel="alternate"][hreflang="${hl}"]`);
    if (!el) { el = document.createElement(`link`); el.setAttribute(`rel`, `alternate`); el.setAttribute(`hreflang`, hl); document.head.appendChild(el); }
    el.setAttribute(`href`, url);
  }
}

// Generic site-wide description per language (restored on non-breed/non-blog
// routes so a breed/post description never leaks across navigation).
const GENERIC_SEO_DESC = {
  he: `הדפסות מותאמות אישית — חולצות, ספלים ומדבקות עם העיצוב שלך, לצד אוסף דיוקנאות BLOOM ל-70 גזעי כלבים וחתולים.`,
  en: `Custom prints — shirts, mugs & stickers with your own design, plus the BLOOM pet-portrait collection across 70 dog & cat breeds.`,
  ru: `Индивидуальная печать — футболки, кружки и стикеры с вашим дизайном, плюс коллекция портретов BLOOM для 70 пород собак и кошек.`,
};

// Per-view meta descriptions (trilingual) for the main non-breed/blog/faq views,
// so each route gets its own description + OG instead of the single generic one.
// Falls back to GENERIC_SEO_DESC for any view not listed (home/admin/policies).
const VIEW_SEO_DESC = {
  he: {
    order: `עצבו מוצר משלכם — העלו תמונה, בחרו חולצה/ספל/מדבקה, צבע ומידה, ואנחנו מדפיסים בישראל ושולחים עד הבית.`,
    pets: `אוסף BLOOM — 70 דיוקנאות מאוירים של כלבים וחתולים על חולצות, ספלים ומדבקות. מצאו את הגזע שלכם.`,
    about: `הסיפור של ספלים שופ — הדפסה מקומית בבאר שבע, באהבה ובדיוק, עם משלוח לכל הארץ.`,
    track: `מעקב אחר ההזמנה שלכם בספלים שופ.`,
  },
  en: {
    order: `Design your own — upload a photo, pick a shirt/mug/sticker, colour and size; printed in Israel and shipped to your door.`,
    pets: `The BLOOM collection — 70 hand-illustrated dog & cat portraits on shirts, mugs and stickers. Find your breed.`,
    about: `The Sfalim Shop story — printed locally in Be'er Sheva with care, shipped anywhere in Israel.`,
    track: `Track your Sfalim Shop order.`,
  },
  ru: {
    order: `Создайте свой товар — загрузите фото, выберите футболку/кружку/стикер, цвет и размер; печатаем в Израиле с доставкой на дом.`,
    pets: `Коллекция BLOOM — 70 рисованных портретов собак и кошек на футболках, кружках и стикерах. Найдите свою породу.`,
    about: `История Sfalim Shop — печатаем в Беэр-Шеве с любовью, доставка по всему Израилю.`,
    track: `Отслеживание вашего заказа в Sfalim Shop.`,
  },
};

// Restore the generic site title/description/OG/Twitter/canonical/hreflang and
// drop any per-page JSON-LD. Called for every route that isn't a breed page or
// a blog page (those own their SEO in their components). `title` is the
// already-resolved per-route document title.
function setGenericSeo(lang, title, descOverride) {
  const desc = descOverride || GENERIC_SEO_DESC[lang] || GENERIC_SEO_DESC.he;
  setMeta(`description`, desc);
  setMeta(`og:title`, title, `property`);
  setMeta(`og:description`, desc, `property`);
  setMeta(`og:type`, `website`, `property`);
  setMeta(`og:url`, `${SEO_ORIGIN}/`, `property`);
  setMeta(`og:image`, SITE_OG_IMAGE, `property`);
  setMeta(`og:locale`, ogLocale(lang), `property`);
  setMeta(`twitter:card`, `summary_large_image`);
  setMeta(`twitter:title`, title);
  setMeta(`twitter:description`, desc);
  setMeta(`twitter:image`, SITE_OG_IMAGE);
  setCanonical(`${SEO_ORIGIN}/`);
  setHreflang(`${SEO_ORIGIN}/`);
  removeJsonLd(`breed-product-ld`);
  removeJsonLd(`blog-article-ld`);
  removeJsonLd(`faq-ld`);
}

// Defensive HTML sanitizer for admin-authored post bodies. Removes dangerous
// tags, on* handlers and javascript: URLs. Content is trusted (admin-only) so
// this is belt-and-suspenders; falls back to a crude script-strip if no parser.
function sanitizeBlogHtml(html) {
  if (!html || typeof html !== `string`) return ``;
  if (typeof window === `undefined` || !window.DOMParser) {
    return html.replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form)[^>]*>/gi, ``);
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, `text/html`);
  const root = doc.body.firstChild;
  const BAD = [`SCRIPT`, `STYLE`, `IFRAME`, `OBJECT`, `EMBED`, `LINK`, `META`, `BASE`, `FORM`];
  root.querySelectorAll(`*`).forEach((el) => {
    if (BAD.includes(el.tagName)) { el.remove(); return; }
    Array.from(el.attributes).forEach((attr) => {
      const n = attr.name.toLowerCase();
      const v = (attr.value || ``).trim().toLowerCase();
      if (n.startsWith(`on`)) el.removeAttribute(attr.name);
      else if ((n === `href` || n === `src` || n === `xlink:href`) && v.indexOf(`javascript:`) === 0) el.removeAttribute(attr.name);
      else if (n === `style` && /expression|javascript:/.test(v)) el.removeAttribute(attr.name);
    });
  });
  return root.innerHTML;
}

// ============ BLOG CARD — reused by index grid + "from our blog" stripe ============
function BlogCard({ post, lang, goToBlog, compact = false }) {
  const isRTL = lang === `he`;
  const title = post[`title_${lang}`] || post.title_he || ``;
  const excerpt = post[`excerpt_${lang}`] || post.excerpt_he || ``;
  const [hover, setHover] = useState(false);
  const open = () => goToBlog && goToBlog(post.slug);
  return (
    <article
      onClick={open}
      onKeyDown={(e) => { if (e.key === `Enter` || e.key === ` `) { e.preventDefault(); open(); } }}
      role="button" tabIndex={0}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: COLORS.bgCard, border: `1px solid ${hover ? COLORS.accent : COLORS.border}`,
        borderRadius: 14, overflow: `hidden`, cursor: `pointer`, display: `flex`, flexDirection: `column`,
        direction: isRTL ? `rtl` : `ltr`, textAlign: isRTL ? `right` : `left`,
        transition: `border-color 0.2s, transform 0.18s cubic-bezier(.2,.6,.2,1), box-shadow 0.3s`,
        transform: hover ? `translateY(-4px)` : `translateY(0)`,
        boxShadow: hover ? `0 16px 40px rgba(0,0,0,0.35)` : `none`,
      }}>
      <div style={{ width: `100%`, aspectRatio: `4 / 3`, background: `#0d0d0d`, overflow: `hidden`, flexShrink: 0 }}>
        {post.cover_image_url && (
          <SmartImage src={post.cover_image_url} alt={post.cover_image_alt_he || title}
            style={{ width: `100%`, height: `100%`, objectFit: `cover`, objectPosition: `center 15%`, display: `block`, transition: `transform 0.5s cubic-bezier(.2,.6,.2,1)`, transform: hover ? `scale(1.05)` : `scale(1)` }} />
        )}
      </div>
      <div style={{ padding: compact ? `16px 18px` : `20px 22px`, display: `flex`, flexDirection: `column`, gap: 8, flex: 1 }}>
        <span style={{ alignSelf: isRTL ? `flex-end` : `flex-start`, color: COLORS.accent, fontFamily: `'IBM Plex Mono','Courier New',monospace`, fontSize: 10, letterSpacing: `1.5px`, textTransform: `uppercase` }}>{blogCategoryLabel(lang, post.category)}</span>
        <h3 style={{ margin: 0, color: COLORS.white, fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: compact ? 19 : 22, lineHeight: 1.25 }}>{title}</h3>
        <p style={{ margin: 0, color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, lineHeight: 1.55, display: `-webkit-box`, WebkitLineClamp: 2, WebkitBoxOrient: `vertical`, overflow: `hidden` }}>{excerpt}</p>
        <div style={{ marginTop: `auto`, paddingTop: 10, display: `flex`, alignItems: `center`, justifyContent: `space-between`, gap: 10 }}>
          <span style={{ color: COLORS.grayLight, fontFamily: `'Varela Round',sans-serif`, fontSize: 12 }}>{formatBlogDate(post.published_at, lang)}</span>
          <span style={{ color: hover ? COLORS.accent : COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, fontWeight: 700, transition: `color 0.2s` }}>{(LANGS[lang] || LANGS.he).blogReadMore}</span>
        </div>
      </div>
    </article>
  );
}

// ============ BLOG INDEX — #/blog ============
const BLOG_PAGE_SIZE = 12;
function BlogIndex({ lang, goToBlog }) {
  const t = LANGS[lang] || LANGS.he;
  const isRTL = lang === `he`;
  const [isMobile, setIsMobile] = useState(typeof window !== `undefined` && window.innerWidth < 768);
  const [posts, setPosts] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [category, setCategory] = useState(`all`);
  const readPageNum = () => {
    const m = rawHash().match(/[?&]page=(\d+)/);
    return m ? Math.max(1, parseInt(m[1], 10)) : 1;
  };
  const [pageNum, setPageNum] = useState(readPageNum);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener(`resize`, h);
    return () => window.removeEventListener(`resize`, h);
  }, []);

  // Page-level SEO for the index.
  useEffect(() => {
    const indexUrl = `${SEO_ORIGIN}/blog`;
    document.title = `${t.blogHeroTitle} — Sfalim Shop`;
    setMeta(`description`, t.blogHeroSubtitle);
    setMeta(`og:title`, t.blogHeroTitle, `property`);
    setMeta(`og:description`, t.blogHeroSubtitle, `property`);
    setMeta(`og:type`, `website`, `property`);
    setMeta(`og:url`, indexUrl, `property`);
    setMeta(`og:locale`, ogLocale(lang), `property`);
    setMeta(`twitter:card`, `summary_large_image`);
    setMeta(`twitter:title`, t.blogHeroTitle);
    setMeta(`twitter:description`, t.blogHeroSubtitle);
    setCanonical(indexUrl);
    setHreflang(indexUrl);
    // Coming from a post → clear its Article block; from a breed → its Product.
    removeJsonLd(`blog-article-ld`);
    removeJsonLd(`breed-product-ld`);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      const offset = (pageNum - 1) * BLOG_PAGE_SIZE;
      let q = supabase
        .from(`blog_posts`)
        .select(`slug,title_he,title_en,title_ru,excerpt_he,excerpt_en,excerpt_ru,cover_image_url,cover_image_alt_he,category,published_at`, { count: `exact` })
        .eq(`status`, `published`)
        .order(`published_at`, { ascending: false })
        .range(offset, offset + BLOG_PAGE_SIZE - 1);
      if (category !== `all`) q = q.eq(`category`, category);
      const { data, count: c, error } = await q;
      if (cancelled) return;
      if (error) { console.error(`Failed to load blog posts:`, error); setPosts([]); setCount(0); setLoadError(true); }
      else { setPosts(data || []); setCount(c || 0); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [category, pageNum, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(count / BLOG_PAGE_SIZE));
  const gotoPageNum = (n) => {
    setPageNum(n);
    window.history.pushState({ page: `blog` }, ``, n > 1 ? `#/blog?page=${n}` : `#/blog`);
    window.scrollTo(0, 0);
  };
  const changeCategory = (c) => {
    setCategory(c); setPageNum(1);
    window.history.pushState({ page: `blog` }, ``, `#/blog`);
  };

  const cats = [{ id: `all`, label: t.blogCategoryAll }, ...BLOG_CATEGORY_IDS.map((id) => ({ id, label: blogCategoryLabel(lang, id) }))];

  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 72, direction: isRTL ? `rtl` : `ltr` }}>
      {/* Hero */}
      <section style={{ position: `relative`, zIndex: 1, padding: isMobile ? `56px 20px 28px` : `90px 40px 40px`, textAlign: `center`, maxWidth: 900, margin: `0 auto` }}>
        <h1 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 900, fontSize: isMobile ? `2.6rem` : `4rem`, color: COLORS.white, margin: `0 0 16px`, letterSpacing: `-0.02em` }}>{t.blogHeroTitle}</h1>
        <p style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: isMobile ? 15 : 18, lineHeight: 1.5, margin: 0 }}>{t.blogHeroSubtitle}</p>
      </section>

      {/* Category filter */}
      <section style={{ position: `relative`, zIndex: 1, maxWidth: 1200, margin: `0 auto`, padding: isMobile ? `0 16px` : `0 40px` }}>
        <div role="tablist" aria-label={t.blogHeroTitle} style={{ display: `flex`, gap: 8, flexWrap: `wrap`, justifyContent: `center`, marginBottom: 32 }}>
          {cats.map((c) => {
            const active = category === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={active} onClick={() => changeCategory(c.id)}
                style={{ background: active ? COLORS.accent : `transparent`, color: active ? `#fff` : COLORS.gray, border: `${active ? 2 : 1}px solid ${active ? COLORS.accent : COLORS.border}`, borderRadius: 999, padding: `9px 20px`, fontSize: 14, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer`, transition: `all 0.2s` }}>{c.label}</button>
            );
          })}
        </div>
      </section>

      {/* Grid */}
      <section style={{ position: `relative`, zIndex: 1, maxWidth: 1200, margin: `0 auto`, padding: isMobile ? `0 16px 80px` : `0 40px 120px` }}>
        {loadError ? (
          <LoadError lang={lang} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div style={{ textAlign: `center`, padding: 80, color: COLORS.gray, fontFamily: `'Varela Round',sans-serif` }}>
            <div style={{ display: `inline-block`, width: 32, height: 32, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: `50%`, animation: `blogSpin 0.8s linear infinite` }} />
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: `center`, padding: 80, color: COLORS.gray, fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontSize: 20 }}>{t.blogEmpty}</div>
        ) : (
          <>
            <div style={{ display: `grid`, gridTemplateColumns: isMobile ? `1fr` : `repeat(auto-fill, minmax(300px, 1fr))`, gap: isMobile ? 16 : 28 }}>
              {posts.map((p) => <BlogCard key={p.slug} post={p} lang={lang} goToBlog={goToBlog} />)}
            </div>
            {totalPages > 1 && (
              <div style={{ display: `flex`, gap: 8, justifyContent: `center`, alignItems: `center`, marginTop: 48, direction: `ltr` }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" onClick={() => gotoPageNum(n)}
                    aria-current={n === pageNum ? `page` : undefined}
                    style={{ minWidth: 40, height: 40, background: n === pageNum ? COLORS.accent : `transparent`, color: n === pageNum ? `#fff` : COLORS.gray, border: `1px solid ${n === pageNum ? COLORS.accent : COLORS.border}`, borderRadius: 8, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700 }}>{n}</button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <style>{`@keyframes blogSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============ BLOG POST — #/blog/<slug> ============
function BlogPost({ slug, lang, goToBlog, setPage, onShareToast }) {
  const t = LANGS[lang] || LANGS.he;
  const isRTL = lang === `he`;
  const [isMobile, setIsMobile] = useState(typeof window !== `undefined` && window.innerWidth < 768);
  const [post, setPost] = useState(null);
  const [pet, setPet] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener(`resize`, h);
    return () => window.removeEventListener(`resize`, h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setNotFound(false); setLoadError(false); setPet(null); setRelated([]);
    window.scrollTo(0, 0);
    (async () => {
      const { data, error } = await supabase
        .from(`blog_posts`).select(`*`)
        .eq(`slug`, slug).eq(`status`, `published`).maybeSingle();
      if (cancelled) return;
      // A real fetch error → retry; a missing/unpublished post → not-found.
      if (error) { console.error(`[blog] load failed:`, error); setLoadError(true); setPost(null); setLoading(false); return; }
      if (!data) { setNotFound(true); setPost(null); setLoading(false); return; }
      setPost(data);
      setLoading(false);
      // No view-count RPC call (intentional).
      if (data.breed_slug_link) {
        const { data: petRow } = await supabase
          .from(`pet_designs`)
          .select(`slug,name_he,name_en,name_ru,mockup_url,mockup_mug_url,price_mug`)
          .eq(`slug`, data.breed_slug_link).eq(`is_active`, true).maybeSingle();
        if (!cancelled && petRow) setPet(petRow);
      }
      const { data: rel } = await supabase
        .from(`blog_posts`)
        .select(`slug,title_he,title_en,title_ru,excerpt_he,excerpt_en,excerpt_ru,cover_image_url,cover_image_alt_he,category,published_at`)
        .eq(`status`, `published`).eq(`category`, data.category).neq(`slug`, slug)
        .order(`published_at`, { ascending: false }).limit(3);
      if (!cancelled && rel) setRelated(rel);
    })();
    return () => { cancelled = true; };
  }, [slug, reloadKey]);

  // SEO meta + OG + JSON-LD Article — language-aware with Hebrew fallback so
  // nothing renders blank. There are NO seo_*_ru columns, so RU falls back to
  // title_ru/excerpt_ru (then _he). Template literals only.
  useEffect(() => {
    if (!post) return;
    const seoTitle =
      (lang === `en` ? (post.seo_title_en || post.title_en) :
       lang === `ru` ? post.title_ru :
       post.seo_title_he) || post.title_he || ``;
    const seoDesc =
      (lang === `en` ? (post.seo_description_en || post.excerpt_en) :
       lang === `ru` ? post.excerpt_ru :
       post.seo_description_he) || post.excerpt_he || ``;
    const ogTitle = post[`title_${lang}`] || post.title_he || ``;
    const ogDesc = post[`excerpt_${lang}`] || post.excerpt_he || ``;
    const postUrl = `${SEO_ORIGIN}/blog/${post.slug}`;
    document.title = `${seoTitle} — Sfalim Shop`;
    setMeta(`description`, seoDesc);
    setMeta(`og:title`, ogTitle, `property`);
    setMeta(`og:description`, ogDesc, `property`);
    setMeta(`og:image`, post.cover_image_url, `property`);
    setMeta(`og:type`, `article`, `property`);
    setMeta(`og:url`, postUrl, `property`);
    setMeta(`og:locale`, ogLocale(lang), `property`);
    setMeta(`twitter:card`, `summary_large_image`);
    setMeta(`twitter:title`, ogTitle);
    setMeta(`twitter:description`, ogDesc);
    if (post.cover_image_url) setMeta(`twitter:image`, post.cover_image_url);
    setCanonical(postUrl);
    setHreflang(postUrl);
    removeJsonLd(`breed-product-ld`); // never both at once
    const ld = {
      "@context": `https://schema.org`, "@type": `Article`,
      "headline": ogTitle, "image": [post.cover_image_url],
      "inLanguage": lang,
      "datePublished": post.published_at, "dateModified": post.updated_at || post.published_at,
      "author": { "@type": `Organization`, "name": `Sfalim Shop` },
      "publisher": { "@type": `Organization`, "name": `Sfalim Shop`, "logo": { "@type": `ImageObject`, "url": BLOG_LOGO_URL } },
      "description": ogDesc,
      "mainEntityOfPage": postUrl,
    };
    injectJsonLd(ld, `blog-article-ld`);
  }, [post, lang]);

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: `100vh`, paddingTop: 72, display: `flex`, alignItems: `center`, justifyContent: `center` }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: `50%`, animation: `blogSpin 0.8s linear infinite` }} />
        <style>{`@keyframes blogSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (loadError) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 120, direction: isRTL ? `rtl` : `ltr` }}>
        <LoadError lang={lang} onRetry={() => setReloadKey(k => k + 1)} />
      </div>
    );
  }
  if (notFound || !post) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 120, textAlign: `center`, direction: isRTL ? `rtl` : `ltr`, padding: `120px 20px` }}>
        <div style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontSize: 28, marginBottom: 20 }}>{t.blogNotFound}</div>
        <button onClick={() => goToBlog()} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 10, padding: `12px 26px`, fontSize: 15, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer` }}>{t.blogBackToList}</button>
      </div>
    );
  }

  const title = post[`title_${lang}`] || post.title_he || ``;
  const bodyHtml = sanitizeBlogHtml(post[`content_${lang}`] || post.content_he || ``);
  const shareUrl = blogShareUrl(post.slug);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); if (onShareToast) onShareToast(t.blogShareCopied); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  const petName = pet ? (pet[`name_${lang}`] || pet.name_he || pet.name_en) : ``;

  return (
    <div style={{ background: COLORS.bg, color: COLORS.white, minHeight: `100vh`, paddingTop: 72, direction: isRTL ? `rtl` : `ltr` }}>
      <article style={{ maxWidth: 820, margin: `0 auto`, padding: isMobile ? `24px 18px 80px` : `40px 24px 120px` }}>
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" style={{ display: `flex`, flexWrap: `wrap`, gap: 8, alignItems: `center`, color: COLORS.grayLight, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, marginBottom: 24 }}>
          <button onClick={() => setPage(`home`)} style={{ background: `none`, border: `none`, color: COLORS.grayLight, cursor: `pointer`, fontFamily: `inherit`, fontSize: `inherit`, padding: 0 }}>{t.blogBreadcrumbHome}</button>
          <span>/</span>
          <button onClick={() => goToBlog()} style={{ background: `none`, border: `none`, color: COLORS.accent, cursor: `pointer`, fontFamily: `inherit`, fontSize: `inherit`, padding: 0 }}>{t.navBlog}</button>
          <span>/</span>
          <span style={{ color: COLORS.gray, overflow: `hidden`, textOverflow: `ellipsis`, whiteSpace: `nowrap`, maxWidth: 200 }}>{title}</span>
        </nav>

        <span style={{ display: `inline-block`, color: COLORS.accent, fontFamily: `'IBM Plex Mono','Courier New',monospace`, fontSize: 11, letterSpacing: `2px`, textTransform: `uppercase`, marginBottom: 12 }}>{blogCategoryLabel(lang, post.category)}</span>
        <h1 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 900, fontSize: isMobile ? `2.2rem` : `3rem`, lineHeight: 1.15, color: COLORS.white, margin: `0 0 12px`, letterSpacing: `-0.01em` }}>{title}</h1>
        <div style={{ color: COLORS.grayLight, fontFamily: `'Varela Round',sans-serif`, fontSize: 13, marginBottom: 28 }}>{t.blogPublishedOn}{formatBlogDate(post.published_at, lang)}</div>

        {/* Cover */}
        {post.cover_image_url && (
          <div style={{ width: `100%`, aspectRatio: `4 / 3`, overflow: `hidden`, borderRadius: 16, marginBottom: 32, background: `#0d0d0d` }}>
            <SmartImage src={post.cover_image_url} alt={post.cover_image_alt_he || title} style={{ width: `100%`, height: `100%`, objectFit: `cover`, objectPosition: `center 15%`, display: `block` }} />
          </div>
        )}

        {/* Body */}
        <div className="blog-body" style={{ color: `#d6d6d6`, fontFamily: `'Varela Round',sans-serif`, fontSize: isMobile ? 16 : 17, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        {/* Related product — deep-links to this breed's modal on the pets page
            (the slug query lives inside the hash; PetsPage parses it open). */}
        {pet && (
          <div onClick={() => { window.location.hash = `/pets?slug=${pet.slug}`; }} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === `Enter`) window.location.hash = `/pets?slug=${pet.slug}`; }}
            style={{ marginTop: 40, display: `flex`, alignItems: `center`, gap: 18, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18, cursor: `pointer`, transition: `border-color 0.2s` }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = COLORS.accent; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = COLORS.border; }}>
            <div style={{ width: 88, height: 88, borderRadius: 12, overflow: `hidden`, flexShrink: 0, background: `#0d0d0d` }}>
              <SmartImage src={pet.mockup_mug_url || pet.mockup_url} alt={petName} style={{ width: `100%`, height: `100%`, objectFit: `cover` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: COLORS.white, fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: 20 }}>{petName}</div>
              <div style={{ color: COLORS.accent, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, marginTop: 6 }}>{t.blogRelatedProduct}</div>
            </div>
          </div>
        )}

        {/* Quiz CTA */}
        <a href="/quiz" style={{ display: `block`, marginTop: 32, textDecoration: `none` }}>
          <div style={{ background: `linear-gradient(135deg, ${COLORS.accentDim}, rgba(255,107,53,0.04))`, border: `1px solid rgba(255,107,53,0.35)`, borderRadius: 16, padding: isMobile ? `20px 22px` : `22px 28px`, textAlign: `center`, color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontWeight: 700, fontSize: isMobile ? 15 : 17 }}>{t.blogQuizCta}</div>
        </a>

        {/* Share */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{t.blogShareTitle}</div>
          <div style={{ display: `flex`, gap: 10, flexWrap: `wrap` }}>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer"
              style={{ background: `#25D366`, color: `#fff`, borderRadius: 10, padding: `11px 20px`, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, textDecoration: `none` }}>{t.blogShareWhatsapp}</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer"
              style={{ background: `#1877F2`, color: `#fff`, borderRadius: 10, padding: `11px 20px`, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, textDecoration: `none` }}>{t.blogShareFacebook}</a>
            <button type="button" onClick={copyLink}
              style={{ background: copied ? COLORS.success : `transparent`, color: copied ? `#000` : COLORS.white, border: `1px solid ${copied ? COLORS.success : COLORS.border}`, borderRadius: 10, padding: `11px 20px`, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, fontWeight: 700, cursor: `pointer`, transition: `all 0.2s` }}>{copied ? t.blogShareCopied : t.blogShareCopy}</button>
          </div>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <h2 style={{ fontFamily: `'Playfair Display',serif`, fontStyle: `italic`, fontWeight: 700, fontSize: isMobile ? `1.5rem` : `2rem`, color: COLORS.white, margin: `0 0 24px` }}>{t.blogRelatedPosts}</h2>
            <div style={{ display: `grid`, gridTemplateColumns: isMobile ? `1fr` : `repeat(3, 1fr)`, gap: isMobile ? 16 : 20 }}>
              {related.map((r) => <BlogCard key={r.slug} post={r} lang={lang} goToBlog={goToBlog} compact />)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 48 }}>
          <button onClick={() => goToBlog()} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 10, padding: `12px 24px`, fontSize: 14, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, cursor: `pointer` }}>{t.blogBackToList}</button>
        </div>
      </article>

      {/* Scoped typography for the post body */}
      <style>{`
        @keyframes blogSpin { to { transform: rotate(360deg); } }
        .blog-body h2 { font-family: 'Playfair Display', serif; font-style: italic; color: #fff; font-size: 1.7rem; margin: 32px 0 14px; line-height: 1.3; }
        .blog-body h3 { font-family: 'Playfair Display', serif; color: #fff; font-size: 1.35rem; margin: 26px 0 12px; }
        .blog-body p { margin: 0 0 18px; }
        .blog-body a { color: #FF6B35; }
        .blog-body ul, .blog-body ol { margin: 0 0 18px; padding-inline-start: 24px; }
        .blog-body li { margin-bottom: 8px; }
        .blog-body img { max-width: 100%; height: auto; border-radius: 12px; margin: 18px 0; }
        .blog-body blockquote { border-inline-start: 3px solid #FF6B35; margin: 18px 0; padding-inline-start: 16px; color: #aaa; font-style: italic; }
        .blog-body strong { color: #fff; }
      `}</style>
    </div>
  );
}

// ============ BLOG ADMIN — list + create/edit + cover upload ============
const BLANK_BLOG_POST = {
  slug: ``, title_he: ``, title_en: ``, title_ru: ``,
  excerpt_he: ``, excerpt_en: ``, excerpt_ru: ``,
  content_he: ``, content_en: ``, content_ru: ``,
  cover_image_url: ``, cover_image_alt_he: ``, breed_slug_link: ``,
  category: `breeds`, seo_title_he: ``, seo_description_he: ``,
  status: `draft`,
};
const slugifyBlog = (s) => (s || ``).toLowerCase().trim().replace(/[^a-z0-9]+/g, `-`).replace(/^-+|-+$/g, ``);

function BlogAdmin({ uploadAdminImage, lang }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false); // false | true (form open)
  const [form, setForm] = useState(BLANK_BLOG_POST);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [breeds, setBreeds] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef(null);

  const fetchPosts = async () => {
    const { data } = await supabase.from(`blog_posts`).select(`*`).order(`created_at`, { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetchPosts();
    supabase.from(`pet_designs`).select(`slug,name_he`).eq(`is_active`, true).order(`sort_order`, { ascending: true }).then(({ data }) => setBreeds(data || []));
  }, []);

  const startNew = () => { setForm(BLANK_BLOG_POST); setEditingId(null); setEditing(true); setShowPreview(false); };
  const startEdit = (p) => {
    setForm({ ...BLANK_BLOG_POST, ...p, breed_slug_link: p.breed_slug_link || ``, slug: p.slug || `` });
    setEditingId(p.id); setEditing(true); setShowPreview(false);
  };
  const cancel = () => { setEditing(false); setEditingId(null); setForm(BLANK_BLOG_POST); };

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCover = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAdminImage(`blog-images`, file, `cover`);
      if (url) upd(`cover_image_url`, url);
    } catch (err) { console.error(`Cover upload failed:`, err); window.alert(`Upload failed`); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ``; }
  };

  const buildRow = (publish) => {
    const slug = (form.slug && form.slug.trim()) || slugifyBlog(form.title_en) || slugifyBlog(form.title_he);
    const row = {
      slug,
      title_he: form.title_he || null, title_en: form.title_en || null, title_ru: form.title_ru || null,
      excerpt_he: form.excerpt_he || null, excerpt_en: form.excerpt_en || null, excerpt_ru: form.excerpt_ru || null,
      content_he: form.content_he || null, content_en: form.content_en || null, content_ru: form.content_ru || null,
      cover_image_url: form.cover_image_url || null, cover_image_alt_he: form.cover_image_alt_he || null,
      breed_slug_link: form.breed_slug_link || null, category: form.category || `breeds`,
      seo_title_he: form.seo_title_he || null, seo_description_he: form.seo_description_he || null,
    };
    if (publish) { row.status = `published`; if (!form.published_at) row.published_at = new Date().toISOString(); }
    else if (!editingId) { row.status = `draft`; }
    return row;
  };

  const save = async (publish) => {
    if (!form.title_he && !form.title_en) { window.alert(`Title required`); return; }
    setBusy(true);
    try {
      const row = buildRow(publish);
      if (!row.slug) { window.alert(`Slug required (add an English title or set slug manually)`); setBusy(false); return; }
      let error;
      if (editingId) ({ error } = await supabase.from(`blog_posts`).update(row).eq(`id`, editingId));
      else ({ error } = await supabase.from(`blog_posts`).insert(row));
      if (error) { console.error(`Save blog post failed:`, error); window.alert(`Save failed: ${error.message}`); setBusy(false); return; }
      await fetchPosts();
      cancel();
    } finally { setBusy(false); }
  };

  const togglePublish = async (p) => {
    const next = p.status === `published` ? `draft` : `published`;
    const patch = { status: next };
    if (next === `published` && !p.published_at) patch.published_at = new Date().toISOString();
    const { error } = await supabase.from(`blog_posts`).update(patch).eq(`id`, p.id);
    if (error) { console.error(error); window.alert(`Failed`); return; }
    fetchPosts();
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete this post permanently?`)) return;
    const { error } = await supabase.from(`blog_posts`).delete().eq(`id`, p.id);
    if (error) { console.error(error); window.alert(`Delete failed`); return; }
    fetchPosts();
  };

  const inp = { width: `100%`, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `10px 12px`, color: COLORS.white, fontFamily: `'Varela Round',sans-serif`, fontSize: 14, outline: `none`, boxSizing: `border-box`, marginTop: 4 };
  const lbl = { color: COLORS.gray, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, display: `block`, marginTop: 12 };
  const field = (label, key, opts = {}) => (
    <label style={lbl}>{label}
      {opts.area
        ? <textarea value={form[key] || ``} onChange={(e) => upd(key, e.target.value)} rows={opts.rows || 4} style={{ ...inp, fontFamily: opts.mono ? `'IBM Plex Mono',monospace` : inp.fontFamily, resize: `vertical` }} />
        : <input value={form[key] || ``} onChange={(e) => upd(key, e.target.value)} style={inp} placeholder={opts.ph || ``} dir={opts.dir || `auto`} />}
    </label>
  );

  return (
    <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, marginBottom: 20, flexWrap: `wrap`, gap: 10 }}>
        <div>
          <h2 style={{ color: COLORS.white, fontFamily: `'Playfair Display',serif`, fontSize: 28, margin: 0 }}>{lang === `he` ? `בלוג` : `Blog`}</h2>
          <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>{loading ? (lang === `he` ? `טוען...` : `Loading...`) : `${posts.length} ${lang === `he` ? `פוסטים` : `posts`}`}</p>
        </div>
        {!editing && (
          <button onClick={startNew} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 8, padding: `10px 16px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{lang === `he` ? `+ פוסט חדש` : `+ New post`}</button>
        )}
      </div>

      {editing && (
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.accent}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 12 }}>
            {field(`slug (a-z 0-9 -)`, `slug`, { ph: `auto from English title`, dir: `ltr` })}
            <label style={lbl}>{lang === `he` ? `קטגוריה` : `Category`}
              <select value={form.category} onChange={(e) => upd(`category`, e.target.value)} style={inp}>
                {BLOG_CATEGORY_IDS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={lbl}>{lang === `he` ? `קישור לגזע (BLOOM)` : `Linked breed (BLOOM)`}
              <select value={form.breed_slug_link || ``} onChange={(e) => upd(`breed_slug_link`, e.target.value)} style={inp}>
                <option value="">—</option>
                {breeds.map((b) => <option key={b.slug} value={b.slug}>{b.slug} · {b.name_he}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 12 }}>
            {field(`title_he`, `title_he`)}
            {field(`title_en`, `title_en`, { dir: `ltr` })}
            {field(`title_ru`, `title_ru`)}
          </div>
          <div style={{ display: `grid`, gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 12 }}>
            {field(`excerpt_he`, `excerpt_he`, { area: true, rows: 2 })}
            {field(`excerpt_en`, `excerpt_en`, { area: true, rows: 2 })}
            {field(`excerpt_ru`, `excerpt_ru`, { area: true, rows: 2 })}
          </div>

          {/* Cover */}
          <div style={{ display: `flex`, alignItems: `center`, gap: 14, marginTop: 14, flexWrap: `wrap` }}>
            <div style={{ width: 120, height: 68, borderRadius: 8, overflow: `hidden`, background: `#0d0d0d`, border: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
              {form.cover_image_url ? <img src={form.cover_image_url} alt="" style={{ width: `100%`, height: `100%`, objectFit: `cover` }} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleCover} style={{ display: `none` }} />
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: `8px 14px`, fontSize: 12, fontWeight: 700, cursor: uploading ? `wait` : `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{uploading ? `…` : (lang === `he` ? `העלה כריכה` : `Upload cover`)}</button>
              {field(`cover_image_url`, `cover_image_url`, { dir: `ltr` })}
            </div>
          </div>
          {field(`cover_image_alt_he`, `cover_image_alt_he`)}

          {field(`content_he (HTML)`, `content_he`, { area: true, rows: 12, mono: true })}
          {field(`content_en (HTML)`, `content_en`, { area: true, rows: 8, mono: true })}
          {field(`content_ru (HTML)`, `content_ru`, { area: true, rows: 8, mono: true })}

          {field(`seo_title_he`, `seo_title_he`)}
          {field(`seo_description_he`, `seo_description_he`, { area: true, rows: 2 })}

          {showPreview && (
            <div style={{ marginTop: 16, border: `1px dashed ${COLORS.border}`, borderRadius: 10, padding: 16, background: COLORS.bg }}>
              <div style={{ color: COLORS.accent, fontSize: 11, fontFamily: `'IBM Plex Mono',monospace`, marginBottom: 10 }}>PREVIEW (content_he)</div>
              <div className="blog-body" style={{ color: `#d6d6d6`, fontFamily: `'Varela Round',sans-serif`, fontSize: 16, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(form.content_he) }} />
            </div>
          )}

          <div style={{ display: `flex`, gap: 10, marginTop: 18, flexWrap: `wrap` }}>
            <button onClick={() => save(false)} disabled={busy} style={{ background: COLORS.bg, color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `10px 18px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{busy ? `…` : (lang === `he` ? `שמור טיוטה` : `Save draft`)}</button>
            <button onClick={() => save(true)} disabled={busy} style={{ background: COLORS.accentBtn, color: `#fff`, border: `none`, borderRadius: 8, padding: `10px 18px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{busy ? `…` : (lang === `he` ? `פרסם` : `Publish`)}</button>
            <button onClick={() => setShowPreview((s) => !s)} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 8, padding: `10px 18px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{lang === `he` ? `תצוגה מקדימה` : `Preview`}</button>
            <button onClick={cancel} style={{ background: `transparent`, color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: `10px 18px`, fontWeight: 700, fontSize: 13, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif` }}>{lang === `he` ? `ביטול` : `Cancel`}</button>
            <style>{`.blog-body h2{font-family:'Playfair Display',serif;font-style:italic;color:#fff;font-size:1.5rem;margin:20px 0 10px} .blog-body p{margin:0 0 14px} .blog-body a{color:#FF6B35} .blog-body img{max-width:100%;height:auto;border-radius:10px}`}</style>
          </div>
        </div>
      )}

      {!loading && !editing && (
        <div style={{ display: `flex`, flexDirection: `column`, gap: 8 }}>
          {posts.length === 0 && <div style={{ color: COLORS.gray, fontSize: 14, padding: 16 }}>{lang === `he` ? `אין פוסטים עדיין` : `No posts yet`}</div>}
          {posts.map((p) => (
            <div key={p.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: `10px 14px`, display: `flex`, alignItems: `center`, gap: 12, flexWrap: `wrap` }}>
              <span style={{ background: p.status === `published` ? `rgba(74,222,128,0.15)` : `rgba(255,255,255,0.06)`, color: p.status === `published` ? COLORS.success : COLORS.gray, borderRadius: 6, padding: `4px 10px`, fontSize: 11, fontWeight: 700, fontFamily: `'Varela Round',sans-serif`, flexShrink: 0 }}>{p.status}</span>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ color: COLORS.white, fontWeight: 600, fontFamily: `'Playfair Display',serif` }}>{p.title_he || p.title_en || p.slug}</div>
                <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{[p.category, p.published_at ? formatBlogDate(p.published_at, lang) : `—`, `${p.views_count || 0} ${lang === `he` ? `צפיות` : `views`}`].filter(Boolean).join(` · `)}</div>
              </div>
              <div style={{ display: `flex`, gap: 8, flexWrap: `wrap` }}>
                <button onClick={() => startEdit(p)} style={{ background: `transparent`, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: `6px 12px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>{lang === `he` ? `ערוך` : `Edit`}</button>
                <button onClick={() => togglePublish(p)} style={{ background: `transparent`, color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: `6px 12px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>{p.status === `published` ? (lang === `he` ? `הסתר` : `Unpublish`) : (lang === `he` ? `פרסם` : `Publish`)}</button>
                <button onClick={() => remove(p)} style={{ background: `transparent`, color: `#ef4444`, border: `1px solid #ef4444`, borderRadius: 6, padding: `6px 12px`, cursor: `pointer`, fontFamily: `'Varela Round',sans-serif`, fontSize: 12, fontWeight: 700 }}>{lang === `he` ? `מחק` : `Delete`}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
