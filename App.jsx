import React, { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { createClient } from '@supabase/supabase-js'

// Mug Studio is code-split: the studio component (≈25KB) and its dynamic
// `import('three')` (≈190KB gz) ship in their own chunks and load ONLY when a
// visitor opens #mug-studio. The main app bundle stays free of three.js.
const MugStudio = lazy(() => import('./MugStudio.jsx'));
const supabase = createClient('https://ubvgrxlxtelulwjtfudd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmdyeGx4dGVsdWx3anRmdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODIyODMsImV4cCI6MjA5NDM1ODI4M30.79zQ0LMAzzocGSMD3ruNl2m_jan6siQJ_A1Ex7lOxyE')

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
.fpc-details h3 {
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
  .fpc-details h3 { font-size: min(4svh, 2em); }
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
  .fpc-details h3 { font-size: min(3.5svh, 1.7em); }
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
  onAddToCart
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
            <img
              className="fpc-avatar"
              src={imageUrl}
              alt={name || `מוצר`}
              loading="lazy"
              onError={(e) => { e.target.style.display = `none`; }} />
          </div>
          <div className="fpc-shine" />
          <div className="fpc-glare" />
          <div className="fpc-content">
            <div className="fpc-details">
              <h3>{name}</h3>
              <p>{description}</p>
            </div>
          </div>
          <div className="fpc-user-info">
            <div className="fpc-user-details">
              <div className="fpc-user-text">
                <div className="fpc-handle">{price}</div>
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

// ============================================================================
// HomeFloatingBloomCarousel — מציג את כל דמויות BLOOM כקרוסלת כרטיסים מרחפים.
// טוען מ-Supabase, מתחלף אוטומטית כל 5 שניות (נעצר ב-hover), עם נקודות + swipe.
// כפתור כל דמות מנווט ל-#pets/<slug> שלה (אותה לוגיקת slug כמו ב-PetsPage).
// ============================================================================
function HomeFloatingBloomCarousel({ lang, setPage }) {
  const [designs, setDesigns] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef(null);

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
    styleEl.textContent = `.bloom-carousel-inactive, .bloom-carousel-inactive * { pointer-events: none !important; }`;
    document.head.appendChild(styleEl);
  }, []);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pet_designs")
          .select("id,name_he,name_en,name_ru,animal_he,animal_en,animal_ru,tagline_he,tagline_en,tagline_ru,price_shirt,mockup_url,design_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        if (cancelled || !data) return;
        // Fisher-Yates shuffle so each fresh page load starts with a different
        // character. Runs once (this effect has empty deps + setDesigns is only
        // called here) so the order is stable for the rest of the session —
        // it never reshuffles while the user is watching.
        const shuffled = data.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = shuffled[i];
          shuffled[i] = shuffled[j];
          shuffled[j] = tmp;
        }
        setDesigns(shuffled);
      } catch (err) {
        console.error(`Failed to load BLOOM carousel:`, err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-advance every 5s, paused on hover or while user is mid-swipe.
  useEffect(() => {
    if (isPaused || designs.length <= 1) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % designs.length);
    }, 5000);
    return () => clearInterval(id);
  }, [isPaused, designs.length]);

  if (!designs.length) return null;

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

  const buildSlug = (name) => {
    const s = (name || ``).toLowerCase().replace(/[^a-z0-9]+/g, `-`).replace(/^-+|-+$/g, ``);
    return s;
  };

  // Single click handler shared by every card in the stack. Reads the latest
  // active index and designs list from refs at click time, so the navigation
  // target always matches the character currently visible — never stale.
  const handleViewActiveCharacter = () => {
    const list = designsRef.current;
    const idx = activeIdxRef.current;
    const d = list && list[idx];
    if (!d || typeof setPage !== `function`) return;
    const slug = buildSlug(d.name_en) || String(d.id);
    setPage(`pets/${slug}`);
  };

  const goPrev = () => setActiveIdx((i) => (i - 1 + designs.length) % designs.length);
  const goNext = () => setActiveIdx((i) => (i + 1) % designs.length);

  // Touch swipe — threshold 40px so taps and tiny drifts don't trigger nav.
  // Same direction semantics as a typical carousel: swipe LEFT = next, RIGHT = prev.
  const onTouchStart = (e) => {
    if (!e.touches.length) return;
    touchStartXRef.current = e.touches[0].clientX;
    setIsPaused(true);
  };
  const onTouchEnd = (e) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    setIsPaused(false);
    if (startX == null || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext(); else goPrev();
  };

  return (
    <section
      style={{
        width: `100%`,
        background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.18) 0%, transparent 60%), ${COLORS.bg}`,
        padding: isMobile ? `96px 16px 32px` : `120px 24px 48px`,
        display: `flex`,
        flexDirection: `column`,
        alignItems: `center`,
        direction: lang === `he` ? `rtl` : `ltr`,
        boxSizing: `border-box`,
      }}>
      <div
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

      {/* Carousel stack — all cards rendered, cross-fade via opacity. */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          position: `relative`,
          width: isMobile ? 280 : 360,
          maxWidth: `100%`,
        }}>
        {designs.map((d, idx) => {
          const tagline = d[`tagline_${lang}`] || d.tagline_he || d.tagline_en || ``;
          const animal = d[`animal_${lang}`] || d.animal_he || d.animal_en || ``;
          const description = [tagline, animal].filter(Boolean).join(` · `);
          const displayName = (d.name_en || d.name_he || ``).toUpperCase();
          const isActive = idx === activeIdx;
          return (
            <div
              key={d.id}
              className={isActive ? `` : `bloom-carousel-inactive`}
              aria-hidden={!isActive}
              style={{
                position: idx === 0 ? `relative` : `absolute`,
                top: 0,
                left: 0,
                right: 0,
                opacity: isActive ? 1 : 0,
                transition: `opacity 0.6s ease-in-out`,
              }}>
              <FloatingProductCard
                imageUrl={d.mockup_url}
                name={displayName}
                description={description}
                price={`₪${Number(d.price_shirt) || 129}`}
                status={statusByLang[lang] || statusByLang.he}
                buttonText={buttonByLang[lang] || buttonByLang.he}
                onAddToCart={handleViewActiveCharacter}
              />
            </div>
          );
        })}
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
                width: isActive ? 28 : 10,
                height: 10,
                borderRadius: 999,
                background: isActive ? `#f97316` : `rgba(255,255,255,0.25)`,
                border: `none`,
                cursor: `pointer`,
                padding: 0,
                transition: `width 0.3s ease, background-color 0.3s ease`,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

const COLORS = {
  bg: "#0f0f0f", bgCard: "#1a1a1a", border: "#2a2a2a",
  accent: "#FF6B35", accentHover: "#ff8255", accentDim: "rgba(255,107,53,0.15)",
  white: "#ffffff", gray: "#888888", grayLight: "#555555", success: "#4ade80",
};

const SHIPPING_PRICE = 30;
const ADMIN_EMAIL = "gleb2009@gmail.com";

// ============ BLOOM shirt colors — 5 basic options for the Pet Couture collection ============
const BLOOM_SHIRT_COLORS = [
  { id: "white", hex: "#ffffff", he: "לבן",  en: "White", ru: "Белый" },
  { id: "black", hex: "#1a1a1a", he: "שחור", en: "Black", ru: "Чёрный" },
  { id: "gray",  hex: "#9ca3af", he: "אפור", en: "Gray",  ru: "Серый" },
  { id: "navy",  hex: "#1e3a5f", he: "נייבי", en: "Navy",  ru: "Тёмно-синий" },
  { id: "sand",  hex: "#d4c5a9", he: "חול",  en: "Sand",  ru: "Песочный" },
  { id: "pink",  hex: "#f9a8d4", he: "ורוד", en: "Pink",  ru: "Розовый" },
];

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
// Visit ?staff=1 to access login during maintenance.
const MAINTENANCE_MODE = true;

// 🔒 MUG STUDIO ACCESS — when false, the #mug-studio route is removed from
// VALID_PAGES (so the hash router falls back to 'home'), the render block
// is short-circuited, the add-to-cart helper no-ops, and the maintenance
// gate no longer makes any exception for it. MugStudio.jsx stays on disk
// and stays code-split — flip to true to re-enable.
const MUG_STUDIO_ENABLED = false;

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
    hero: { badge: "הדפסות מותאמות אישית · ישראל 🇮🇱", h1line1: "העיצוב שלך.", h1line2: "על הכל.", sub: "חולצות, ספלים, מדבקות — מותאמים אישית עם העיצוב שלך.", cta: "עצב בעצמך ←", ctaSecondary: "עיין באוסף BLOOM", from: "החל מ-₪" },
    trust: { shipping: "משלוח ₪30", delivery: "אספקה 3–10 ימי עסקים", secure: "תשלום מאובטח", returns: "החזרים והחלפות בקלות" },
    badges: { bestseller: "רב מכר", new: "חדש" },
    reviews: { eyebrow: "ביקורות לקוחות", title: "מה אומרים עלינו", aria: "ביקורת לקוח" },
    steps: ["מוצר", "עיצוב", "פרטים", "תשלום", "סיום"],
    product: { title: "בחר מוצר", sub: "מה תרצה להתאים אישית?", options: "אפשרויות", from: "החל מ-₪", continue: "המשך ←" },
    customize: { title: (p) => `התאם: ${p}`, sub: "העלה עיצוב וראה תצוגה מקדימה.", size: "מידה", option: "אפשרות", color: "צבע", design: "העיצוב שלך", uploadTitle: "העלה עיצוב", uploadSub: "PNG, JPG, SVG · רזולוציה גבוהה", uploaded: "עיצוב הועלה ✓", changeFile: "לחץ לשינוי", dragHint: "גרור לשינוי מיקום", designSize: "גודל עיצוב", shipping: "משלוח", total: "סה״כ", back: "← חזרה", continue: "המשך ←" },
    form: { title: "הפרטים שלך", sub: "כמעט סיימנו!", name: "שם מלא *", namePh: "השם שלך", email: "מייל *", emailPh: "your@email.com", phone: "טלפון", phonePh: "1234567", notes: "הערות", notesPh: "בקשות מיוחדות...", qty: "כמות", summary: "סיכום", shipping: "משלוח", total: "סה״כ", paymentNote: "תשלום בשלב הבא", paymentSub: "תשלום מאובטח דרך טרנזילה.", back: "← חזרה", place: "המשך לתשלום ←" },
    payment: { title: "תשלום מאובטח", subtitle: "סקור ואשר את ההזמנה", orderNum: "הזמנה מס׳", summary: "סיכום הזמנה", subtotal: "סכום פריטים", shipping: "משלוח", total: "סה״כ לתשלום", deliveryTo: "כתובת למשלוח", payBtn: "תשלם ", paySuffix: " בבטחה ←", processing: "מעבד...", soonTitle: "מערכת התשלום מגיעה בקרוב", soonSub: "אנחנו בתהליך אישור מול חברת הסליקה. ההזמנה שלך נשמרה ואנחנו ניצור איתך קשר אישית כשהמערכת תפעל.", soonBtn: "סגירה ושמירת הזמנה", cancel: "ביטול הזמנה", editDetails: "← עריכת פרטים", confirmCancel: "האם לבטל את ההזמנה?", securedBy: "מאובטח על ידי", acceptedCards: "אמצעי תשלום:", businessLine: "ספלים שופ · עוסק פטור 321630279", trustFast: "תשלום מהיר ומאובטח", trustSSL: "הצפנת SSL 256-bit", trustReturn: "החזרים תוך 14 יום *", trustNoSave: "פרטי כרטיס לא נשמרים אצלנו" },
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
    admin: { title: "לוח ניהול", orders: "הזמנות", total: "סה״כ", statuses: { received: "התקבלה", design: "בעיצוב", printing: "בהדפסה", ready: "מוכן", shipped: "נשלח", delivered: "נמסר" }, customer: "לקוח", updateStatus: "עדכן סטטוס", noOrders: "אין הזמנות" },
    products: { tshirt: "חולצת טי בייסיק", oversized: "חולצת אוברסייז", dryfit: "חולצת דרייפיט", mug: "ספל", sticker: "מדבקה עגולה", sticker_sq: "מדבקה מרובעת" },
    variants: { standard: "סטנדרט 11oz", large: "גדול 15oz", magic: "משנה צבע", small: "קטן 5×5 ס״מ", medium: "בינוני 10×10 ס״מ", largeS: "גדול 15×15 ס״מ", sheet: "גיליון מדבקות" },
  },
  en: {
    dir: "ltr", label: "EN",
    nav: { home: "Home", order: "Order", pets: "BLOOM", track: "Track Order", about: "About", login: "Login", logout: "Logout", admin: "Admin" },
    hero: { badge: "Custom Prints · Made in Israel 🇮🇱", h1line1: "Your design.", h1line2: "On everything.", sub: "T-shirts, mugs, stickers — fully customized with your design.", cta: "Design your own →", ctaSecondary: "Browse the BLOOM collection", from: "from ₪" },
    trust: { shipping: "Shipping ₪30", delivery: "Delivery 3–10 business days", secure: "Secure payment", returns: "Easy returns & exchanges" },
    badges: { bestseller: "Bestseller", new: "New" },
    reviews: { eyebrow: "Customer reviews", title: "What customers say", aria: "Customer review" },
    steps: ["Product", "Customize", "Details", "Payment", "Done"],
    product: { title: "Choose your product", sub: "What would you like to customize?", options: "options", from: "from ₪", continue: "Continue →" },
    customize: { title: (p) => `Customize: ${p}`, sub: "Upload your design and preview it.", size: "Size", option: "Option", color: "Color", design: "Your Design", uploadTitle: "Upload design", uploadSub: "PNG, JPG, SVG · High resolution", uploaded: "Design uploaded ✓", changeFile: "Click to change", dragHint: "Drag to reposition", designSize: "Design Size", shipping: "Shipping", total: "Total", back: "← Back", continue: "Continue →" },
    form: { title: "Your details", sub: "Almost there!", name: "Full Name *", namePh: "Your name", email: "Email *", emailPh: "your@email.com", phone: "Phone", phonePh: "1234567", notes: "Notes", notesPh: "Special requests...", qty: "Quantity", summary: "Summary", shipping: "Shipping", total: "Total", paymentNote: "Payment on next step", paymentSub: "Secure payment via Tranzila.", back: "← Back", place: "Continue to Payment →" },
    payment: { title: "Secure Payment", subtitle: "Review and confirm your order", orderNum: "Order #", summary: "Order Summary", subtotal: "Subtotal", shipping: "Shipping", total: "Total to Pay", deliveryTo: "Delivery Address", payBtn: "Pay ", paySuffix: " Securely →", processing: "Processing...", soonTitle: "Payment system coming soon", soonSub: "We're finalizing setup with our payment processor. Your order is saved and we'll personally contact you when the system is live.", soonBtn: "Close and save order", cancel: "Cancel Order", editDetails: "← Edit Details", confirmCancel: "Cancel this order?", securedBy: "Secured by", acceptedCards: "We accept:", businessLine: "Sfalim Shop · Exempt Dealer 321630279", trustFast: "Fast and secure payment", trustSSL: "256-bit SSL encryption", trustReturn: "14-day returns *", trustNoSave: "We never store card details" },
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
    admin: { title: "Admin Dashboard", orders: "Orders", total: "total", statuses: { received: "Received", design: "Design", printing: "Printing", ready: "Ready", shipped: "Shipped", delivered: "Delivered" }, customer: "Customer", updateStatus: "Update Status", noOrders: "No orders yet" },
    products: { tshirt: "Basic T-Shirt", oversized: "Oversized T-Shirt", dryfit: "Dryfit T-Shirt", mug: "Custom Mug", sticker: "Round Sticker", sticker_sq: "Square Sticker" },
    variants: { standard: "Standard 11oz", large: "Large 15oz", magic: "Magic Color Change", small: "Small 5×5cm", medium: "Medium 10×10cm", largeS: "Large 15×15cm", sheet: "Sticker Sheet" },
  },
  ru: {
    dir: "ltr", label: "RU",
    nav: { home: "Главная", order: "Заказ", pets: "BLOOM", track: "Отследить", about: "О нас", login: "Войти", logout: "Выйти", admin: "Админ" },
    hero: { badge: "Индивидуальная печать · Израиль 🇮🇱", h1line1: "Ваш дизайн.", h1line2: "На всём.", sub: "Футболки, кружки, стикеры — с вашим дизайном.", cta: "Создать свой →", ctaSecondary: "Каталог BLOOM", from: "от ₪" },
    trust: { shipping: "Доставка ₪30", delivery: "Срок 3–10 рабочих дней", secure: "Безопасная оплата", returns: "Лёгкий возврат и обмен" },
    badges: { bestseller: "Хит продаж", new: "Новинка" },
    reviews: { eyebrow: "Отзывы клиентов", title: "Что говорят о нас", aria: "Отзыв клиента" },
    steps: ["Товар", "Дизайн", "Детали", "Оплата", "Готово"],
    product: { title: "Выберите товар", sub: "Что хотите настроить?", options: "варианта", from: "от ₪", continue: "Продолжить →" },
    customize: { title: (p) => `Настройте: ${p}`, sub: "Загрузите дизайн и посмотрите превью.", size: "Размер", option: "Вариант", color: "Цвет", design: "Ваш дизайн", uploadTitle: "Загрузить дизайн", uploadSub: "PNG, JPG, SVG · Высокое разрешение", uploaded: "Дизайн загружен ✓", changeFile: "Нажмите для изменения", dragHint: "Перетащите для позиции", designSize: "Размер дизайна", shipping: "Доставка", total: "Итого", back: "← Назад", continue: "Продолжить →" },
    form: { title: "Ваши данные", sub: "Почти готово!", name: "Полное имя *", namePh: "Ваше имя", email: "Email *", emailPh: "your@email.com", phone: "Телефон", phonePh: "1234567", notes: "Заметки", notesPh: "Особые пожелания...", qty: "Количество", summary: "Итог", shipping: "Доставка", total: "Итого", paymentNote: "Оплата на следующем шаге", paymentSub: "Безопасная оплата через Tranzila.", back: "← Назад", place: "Перейти к оплате →" },
    payment: { title: "Безопасная оплата", subtitle: "Проверьте и подтвердите заказ", orderNum: "Заказ №", summary: "Сводка заказа", subtotal: "Промежуточный итог", shipping: "Доставка", total: "Итого к оплате", deliveryTo: "Адрес доставки", payBtn: "Оплатить ", paySuffix: " безопасно →", processing: "Обработка...", soonTitle: "Платёжная система скоро запустится", soonSub: "Мы завершаем настройку с провайдером платежей. Ваш заказ сохранён, мы свяжемся с вами лично, когда система заработает.", soonBtn: "Закрыть и сохранить заказ", cancel: "Отменить заказ", editDetails: "← Изменить данные", confirmCancel: "Отменить заказ?", securedBy: "Защищено", acceptedCards: "Способы оплаты:", businessLine: "Sfalim Shop · Освобождённый предприниматель 321630279", trustFast: "Быстрая и безопасная оплата", trustSSL: "256-bit SSL шифрование", trustReturn: "Возврат в течение 14 дней *", trustNoSave: "Мы не сохраняем данные карты" },
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
    admin: { title: "Панель администратора", orders: "Заказов", total: "всего", statuses: { received: "Получен", design: "Дизайн", printing: "Печать", ready: "Готов", shipped: "Отправлен", delivered: "Доставлен" }, customer: "Клиент", updateStatus: "Обновить статус", noOrders: "Заказов нет" },
    products: { tshirt: "Базовая футболка", oversized: "Оверсайз футболка", dryfit: "Драйфит футболка", mug: "Кружка", sticker: "Круглый стикер", sticker_sq: "Квадратный стикер" },
    variants: { standard: "Стандарт 11oz", large: "Большой 15oz", magic: "Меняет цвет", small: "Маленький 5×5см", medium: "Средний 10×10см", largeS: "Большой 15×15см", sheet: "Лист стикеров" },
  },
};

// === Business info & legal policies ===
const BUSINESS_INFO = {
  name: { he: "ספלים שופ", en: "Sfalim Shop", ru: "Sfalim Shop" },
  tagline: { he: "מעוצב לסגנון שלך", en: "Designed for Your Style", ru: "Создано в вашем стиле" },
  vatId: "321630279", // עוסק פטור
  address: { he: "רח׳ י\"א הספורטאים 28, באר שבע", en: "11 HaSportaim St. 28, Be'er Sheva, Israel", ru: "ул. 11 Спортсменов 28, Беэр-Шева, Израиль" },
  phone: "054-6841662",
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
      { type: "h", text: "6. ביטול מצד בית העסק" },
      { type: "p", text: "ספלים שופ שומרת על הזכות לבטל הזמנה ולהחזיר את הכסף במקרים של חוסר במלאי, שגיאה במחיר, חשד להונאה, או תוכן פוגעני/אלים/המפר זכויות יוצרים." },
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
    ],
    privacy: [
      { type: "h", text: "איזה מידע אנחנו אוספים" },
      { type: "l", items: ["מידע אישי: שם מלא, אימייל, טלפון, כתובת למשלוח", "מידע על ההזמנה: מוצרים, עיצובים, הערות", "מידע טכני (אוטומטי): IP, סוג דפדפן, Cookies בסיסיים"] },
      { type: "h", text: "מטרת איסוף המידע" },
      { type: "l", items: ["ביצוע ההזמנה והאספקה", "תקשורת עם הלקוח", "תמיכה ופניות", "שיפור השירות", "עמידה בדרישות חוק"] },
      { type: "h", text: "מה אנחנו לא עושים" },
      { type: "l", items: ["לא נמכור את פרטיך לצדדים שלישיים", "לא נשלח ספאם ללא הסכמה", "לא נשמור פרטי אשראי (התשלום דרך Tranzila — חברה מאובטחת PCI-DSS)"] },
      { type: "h", text: "אבטחת מידע" },
      { type: "p", text: "האתר מאובטח ב-SSL (HTTPS). בסיס הנתונים מאוחסן ב-Supabase עם הצפנה. פרטי תשלום עוברים ישירות ל-Tranzila." },
      { type: "h", text: "הצהרת PCI DSS — אבטחת כרטיסי אשראי" },
      { type: "p", text: "ספלים שופ מצהירה על עמידה בדרישות האבטחה של ארגוני כרטיסי האשראי ובתקן PCI DSS:" },
      { type: "l", items: ["בית העסק אינו שומר פרטי כרטיסי אשראי במערכות שלו או באופן ידני כלשהו", "ספק דף התשלום המאובטח שלנו הוא Tranzila — חברה מוסמכת PCI DSS Level 1, רמת האבטחה הגבוהה ביותר בתעשייה", "פרטי האשראי נשלחים ישירות מהלקוח ל-Tranzila בערוץ מוצפן (SSL/TLS)", "אנו לא רואים, לא שומרים, ולא יכולים לגשת לפרטי האשראי בשום שלב"] },
      { type: "h", text: "שיתוף מידע עם צדדים שלישיים" },
      { type: "p", text: "המידע ישותף אך ורק עם חברת השליחים (לאספקה), Tranzila (לתשלום), ורשויות החוק אם נדרש בצו." },
      { type: "h", text: "הזכויות שלך" },
      { type: "p", text: "יש לך זכות לעיין, לתקן, למחוק ולקבל את המידע שלך. לבקשה — שלח אימייל ל-hello@sfalimshop.com." },
    ],
    terms: [
      { type: "h", text: "כללי" },
      { type: "p", text: "השימוש באתר מהווה הסכמה לתנאי תקנון זה. בית העסק רשאי לעדכן את התקנון בכל עת." },
      { type: "h", text: "כשרות לרכישה" },
      { type: "p", text: "מינימום גיל 18 (או באישור הורה). חובת מסירת פרטים אמיתיים ומלאים." },
      { type: "h", text: "הזמנות ותשלום" },
      { type: "p", text: "ההזמנה נחשבת מאושרת רק לאחר אישור התשלום. אישור ישלח לאימייל. מחירים בשקלים חדשים — כוללים מע\"מ במידת הצורך. תשלום דרך Tranzila." },
      { type: "h", text: "⚠️ זכויות יוצרים ותוכן פוגעני" },
      { type: "p", text: "הלקוח מתחייב להעלות רק עיצובים שיש לו זכויות עליהם. אסור להעלות:" },
      { type: "l", items: ["תוכן פוגעני, גזעני, אלים או מיני", "לוגואים/דמויות מוגנים בזכויות יוצרים (דיסני, מארוול, NBA, אנימה וכו')", "תוכן המסית לאלימות או שנאה", "תוכן המפר חוק"] },
      { type: "p", text: "הלקוח אחראי באופן בלעדי על התוכן שמעלה. ספלים שופ שומרת על הזכות לסרב להדפיס תוכן פוגעני ולבטל את ההזמנה." },
      { type: "h", text: "הגבלת אחריות" },
      { type: "p", text: "ספלים שופ אינה אחראית לנזקים עקיפים, שינויי גוון מינוריים בין מסך להדפסה בפועל, או כישלון אספקה כתוצאה מ-Force Majeure." },
      { type: "h", text: "סמכות שיפוט" },
      { type: "p", text: "בכל מחלוקת — הסמכות הבלעדית לבתי המשפט המוסמכים במחוז הדרום (באר שבע)." },
    ],
    accessibility: [
      { type: "p", text: "ספלים שופ מחויבת לאפשר שימוש באתר לכל אדם, כולל אנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, תשנ\"ח-1998." },
      { type: "h", text: "רמת ההנגשה" },
      { type: "p", text: "האתר נבנה בהתאם לתקן WCAG 2.1 רמה AA." },
      { type: "h", text: "התאמות שיושמו" },
      { type: "l", items: ["תפריט נגישות במסך (שינוי גופן, ניגודיות, ביטול אנימציות)", "ניווט מקלדת מלא (Tab, Enter, Esc)", "טקסט חלופי (alt) לכל התמונות", "ניגודיות צבעים עומדת בתקן AA", "תמיכה בקוראי מסך (NVDA, JAWS, VoiceOver)", "תמיכה ב-3 שפות: עברית, אנגלית, רוסית"] },
      { type: "h", text: "פנייה בנושא נגישות" },
      { type: "p", text: "אם נתקלת בבעיית נגישות, פנה לאימייל hello@sfalimshop.com או לטלפון 054-6841662. נטפל תוך 48 שעות." },
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
      { type: "h", text: "6. Cancellation by Sfalim Shop" },
      { type: "p", text: "We reserve the right to cancel orders and refund payment in cases of stock shortage, pricing errors, suspected fraud, or offensive/copyrighted content." },
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
    ],
    privacy: [
      { type: "h", text: "Information We Collect" },
      { type: "l", items: ["Personal: full name, email, phone, shipping address", "Order data: products, designs, notes", "Technical (automatic): IP, browser type, basic cookies"] },
      { type: "h", text: "Purpose of Collection" },
      { type: "l", items: ["Order fulfillment and delivery", "Customer communication", "Support and inquiries", "Service improvement", "Legal compliance"] },
      { type: "h", text: "What We Do NOT Do" },
      { type: "l", items: ["We will not sell your data to third parties", "No spam without explicit consent", "We do not store credit card details (payment via Tranzila — PCI-DSS compliant)"] },
      { type: "h", text: "Data Security" },
      { type: "p", text: "Site is SSL secured (HTTPS). Database hosted on Supabase with encryption. Payment details go directly to Tranzila." },
      { type: "h", text: "PCI DSS Declaration — Credit Card Security" },
      { type: "p", text: "Sfalim Shop declares compliance with credit card industry security requirements and PCI DSS standards:" },
      { type: "l", items: ["The business does NOT store credit card details in any systems or manually", "Our secure payment page provider is Tranzila — certified PCI DSS Level 1, the highest security level in the industry", "Credit card details are sent directly from the customer to Tranzila via an encrypted channel (SSL/TLS)", "We do not see, store, or have access to credit card details at any stage"] },
      { type: "h", text: "Third-Party Sharing" },
      { type: "p", text: "Information shared only with: shipping company (delivery), Tranzila (payment), and authorities if legally required." },
      { type: "h", text: "Your Rights" },
      { type: "p", text: "You have the right to access, correct, delete, and receive your data. Email hello@sfalimshop.com to request." },
    ],
    terms: [
      { type: "h", text: "General" },
      { type: "p", text: "Using this site constitutes acceptance of these terms. The business may update the terms at any time." },
      { type: "h", text: "Purchase Eligibility" },
      { type: "p", text: "Minimum age 18 (or with parental approval). Must provide accurate and complete information." },
      { type: "h", text: "Orders and Payment" },
      { type: "p", text: "Orders are confirmed only after payment approval. Confirmation sent by email. Prices in Israeli Shekels (ILS) including VAT where applicable. Payment via Tranzila." },
      { type: "h", text: "⚠️ Copyright and Offensive Content" },
      { type: "p", text: "Customer agrees to upload only designs they have rights to. Prohibited content:" },
      { type: "l", items: ["Offensive, racist, violent, or sexual content", "Copyrighted logos/characters (Disney, Marvel, NBA, anime, etc.)", "Content inciting violence or hatred", "Content violating any law"] },
      { type: "p", text: "Customer is solely responsible for uploaded content. Sfalim Shop reserves the right to refuse offensive content and cancel orders." },
      { type: "h", text: "Limitation of Liability" },
      { type: "p", text: "Sfalim Shop is not responsible for indirect damages, minor color variations between screen and actual print, or delivery failures due to Force Majeure." },
      { type: "h", text: "Jurisdiction" },
      { type: "p", text: "Any dispute — exclusive jurisdiction to courts in Southern District (Be'er Sheva), Israel." },
    ],
    accessibility: [
      { type: "p", text: "Sfalim Shop is committed to making the site usable for all, including people with disabilities, per Israel's Equal Rights for Persons with Disabilities Law 5758-1998." },
      { type: "h", text: "Accessibility Level" },
      { type: "p", text: "Site built to WCAG 2.1 Level AA standard." },
      { type: "h", text: "Implemented Accommodations" },
      { type: "l", items: ["On-screen accessibility menu (font size, contrast, animations)", "Full keyboard navigation (Tab, Enter, Esc)", "Alt text for all images", "Color contrast meets AA standard", "Screen reader support (NVDA, JAWS, VoiceOver)", "3-language support: Hebrew, English, Russian"] },
      { type: "h", text: "Accessibility Contact" },
      { type: "p", text: "For accessibility issues, contact hello@sfalimshop.com or 054-6841662. We respond within 48 hours." },
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
      { type: "h", text: "6. Отмена со стороны Sfalim Shop" },
      { type: "p", text: "Мы оставляем за собой право отменить заказ и вернуть деньги в случаях отсутствия товара, ошибок в цене, подозрений в мошенничестве или оскорбительного/нарушающего авторские права контента." },
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
    ],
    privacy: [
      { type: "h", text: "Какую информацию собираем" },
      { type: "l", items: ["Личные данные: имя, email, телефон, адрес доставки", "Данные заказа: товары, дизайны, заметки", "Технические (автоматически): IP, тип браузера, базовые cookies"] },
      { type: "h", text: "Цель сбора" },
      { type: "l", items: ["Выполнение заказа и доставка", "Связь с клиентом", "Поддержка и запросы", "Улучшение сервиса", "Соблюдение закона"] },
      { type: "h", text: "Что мы НЕ делаем" },
      { type: "l", items: ["Не продаём ваши данные третьим лицам", "Не отправляем спам без согласия", "Не храним данные карт (оплата через Tranzila — стандарт PCI-DSS)"] },
      { type: "h", text: "Безопасность данных" },
      { type: "p", text: "Сайт защищён SSL (HTTPS). База данных на Supabase с шифрованием. Платёжные данные идут напрямую в Tranzila." },
      { type: "h", text: "Декларация PCI DSS — безопасность карт" },
      { type: "p", text: "Sfalim Shop заявляет о соответствии требованиям безопасности кредитных карт и стандарту PCI DSS:" },
      { type: "l", items: ["Бизнес НЕ хранит данные кредитных карт в системах или вручную", "Наш поставщик безопасной страницы оплаты — Tranzila, сертифицированный PCI DSS Level 1 (высший уровень безопасности)", "Данные карты передаются напрямую от клиента в Tranzila по зашифрованному каналу (SSL/TLS)", "Мы не видим, не храним и не имеем доступа к данным карт ни на одном этапе"] },
      { type: "h", text: "Передача третьим лицам" },
      { type: "p", text: "Данные передаются только: курьерской службе (доставка), Tranzila (оплата) и властям при законном требовании." },
      { type: "h", text: "Ваши права" },
      { type: "p", text: "Вы имеете право на доступ, исправление, удаление и получение ваших данных. Запросы на hello@sfalimshop.com." },
    ],
    terms: [
      { type: "h", text: "Общие положения" },
      { type: "p", text: "Использование сайта означает согласие с условиями. Бизнес может обновлять условия в любое время." },
      { type: "h", text: "Право на покупку" },
      { type: "p", text: "Минимальный возраст 18 (или с согласия родителя). Обязательное предоставление точных и полных данных." },
      { type: "h", text: "Заказы и оплата" },
      { type: "p", text: "Заказ подтверждается только после одобрения платежа. Подтверждение отправляется на email. Цены в израильских шекелях (ILS) с НДС при необходимости. Оплата через Tranzila." },
      { type: "h", text: "⚠️ Авторские права и недопустимый контент" },
      { type: "p", text: "Клиент обязуется загружать только дизайны с правами. Запрещено:" },
      { type: "l", items: ["Оскорбительный, расистский, агрессивный или сексуальный контент", "Защищённые авторским правом логотипы/персонажи (Disney, Marvel, NBA, аниме и др.)", "Контент, разжигающий насилие или ненависть", "Контент, нарушающий закон"] },
      { type: "p", text: "Клиент несёт исключительную ответственность за загружаемый контент. Sfalim Shop вправе отказать в печати и отменить заказ." },
      { type: "h", text: "Ограничение ответственности" },
      { type: "p", text: "Sfalim Shop не несёт ответственности за косвенный ущерб, незначительные отличия цвета между экраном и печатью, сбои доставки из-за форс-мажора." },
      { type: "h", text: "Подсудность" },
      { type: "p", text: "Любые споры — исключительная подсудность судов Южного округа Израиля (Беэр-Шева)." },
    ],
    accessibility: [
      { type: "p", text: "Sfalim Shop стремится сделать сайт доступным для всех, включая людей с ограниченными возможностями, согласно Закону Израиля о равных правах для людей с инвалидностью 5758-1998." },
      { type: "h", text: "Уровень доступности" },
      { type: "p", text: "Сайт построен по стандарту WCAG 2.1 уровня AA." },
      { type: "h", text: "Реализованные адаптации" },
      { type: "l", items: ["Меню доступности на экране (размер шрифта, контраст, анимации)", "Полная навигация с клавиатуры (Tab, Enter, Esc)", "Alt-текст для всех изображений", "Цветовой контраст соответствует уровню AA", "Поддержка скринридеров (NVDA, JAWS, VoiceOver)", "3 языка: иврит, английский, русский"] },
      { type: "h", text: "Связь по вопросам доступности" },
      { type: "p", text: "По вопросам доступности: hello@sfalimshop.com или 054-6841662. Ответим в течение 48 часов." },
    ],
  },
};

// Localization helpers - translate a saved product/variant name to target language
const PRODUCT_IDS = ['tshirt', 'oversized', 'dryfit', 'mug', 'sticker', 'sticker_sq'];
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
  { id: "oversized",  name: t.products.oversized, desc: { he: "כותנה כבדה 240 גרם · גזרה אוברסייז · הדפסת DTF", en: "Heavy 240gsm cotton · oversize cut · DTF print", ru: "Плотный хлопок 240 г/м² · оверсайз · DTF-печать" }, is_new: true, variants: [{ id: "s", label: "S", price: 99 }, { id: "m", label: "M", price: 99 }, { id: "l", label: "L", price: 99 }, { id: "xl", label: "XL", price: 109 }, { id: "xxl", label: "XXL", price: 109 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "dryfit",     name: t.products.dryfit,    desc: { he: "פוליאסטר נושם · מתאים לאימון · הדפסת סובלימציה", en: "Breathable polyester · sport-ready · sublimation print", ru: "Дышащий полиэстер · для спорта · сублимационная печать" }, variants: [{ id: "s", label: "S", price: 95 }, { id: "m", label: "M", price: 95 }, { id: "l", label: "L", price: 95 }, { id: "xl", label: "XL", price: 105 }, { id: "xxl", label: "XXL", price: 105 }], colors: SHIRT_COLOR_PALETTE, printArea: { x: 40, y: 40, w: 320, h: 320 } },
  { id: "sticker",    name: t.products.sticker,   desc: { he: "מדבקת ויניל עגולה · עמידה במים ובשמש", en: "Round vinyl sticker · water- and UV-resistant", ru: "Круглый виниловый стикер · водо- и UV-устойчивый" }, variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8", "#eff6ff", "#fff7ed", "#fef2f2", "#f0fdfa"], printArea: { x: 20, y: 20, w: 360, h: 360 } },
  { id: "sticker_sq", name: t.products.sticker_sq, desc: { he: "מדבקת ויניל מרובעת · עמידה במים ובשמש", en: "Square vinyl sticker · water- and UV-resistant", ru: "Квадратный виниловый стикер · водо- и UV-устойчивый" }, is_new: true, variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8", "#eff6ff", "#fff7ed", "#fef2f2", "#f0fdfa"], printArea: { x: 20, y: 20, w: 360, h: 360 } },
];

// Format a price range for product cards: "₪89" if min===max, otherwise "₪89–₪99".
const formatPriceRange = (variants) => {
  const prices = variants.map(v => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `₪${min}` : `₪${min}–₪${max}`;
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
  dryfit:     "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/dri%20fit%20t%20shirt.png",
  mug:        "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/mug.png",
  sticker:    "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/round%20sticker.png",
  sticker_sq: "https://ubvgrxlxtelulwjtfudd.supabase.co/storage/v1/object/public/mockups/square%20sticker.png",
};

// SmartImage — drop-in replacement for <img> on product images served from
// Supabase Storage. The first cold-cache fetch occasionally fails and shows
// a broken-image glyph until the user refreshes. SmartImage retries up to
// 3 times with a 500ms back-off, appending ?retry=N as a cache-buster on
// each retry, and paints a gray placeholder background until the image
// successfully loads (or all retries are exhausted). The cache-buster is
// only applied to http(s) URLs so that data:/blob:/relative URLs are left
// untouched.
function SmartImage({ src, alt, style, onError, onLoad, ...rest }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [src]);

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
    }
    if (onError) onError(e);
  };

  const handleLoad = (e) => {
    setLoaded(true);
    if (onLoad) onLoad(e);
  };

  const mergedStyle = {
    ...style,
    backgroundColor: loaded ? (style && style.backgroundColor) : "#222",
  };

  return (
    <img
      {...rest}
      src={finalSrc}
      alt={alt}
      style={mergedStyle}
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
              <label style={labelStyle}>{t.auth.email}</label>
              <input type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
            {success && <div style={{ color: COLORS.success, fontSize: 13, marginBottom: 16, background: "rgba(74,222,128,0.1)", padding: "10px 14px", borderRadius: 8 }}>{success}</div>}
            <button type="submit" disabled={loading} style={{ width: "100%", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
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
              <label style={labelStyle}>{t.auth.name}</label>
              <input type="text" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t.auth.email}</label>
            <input type="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>{t.auth.password}</label>
              {mode === "login" && (
                <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={smallBtnStyle}>{t.auth.forgotPw}</button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ ...inputStyle, padding: t.dir === "rtl" ? "12px 14px 12px 80px" : "12px 80px 12px 14px" }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", [t.dir === "rtl" ? "left" : "right"]: 8, top: 14, ...smallBtnStyle, color: COLORS.gray }}>
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
          {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
          {success && <div style={{ color: COLORS.success, fontSize: 13, marginBottom: 16, background: "rgba(74,222,128,0.1)", padding: "10px 14px", borderRadius: 8 }}>{success}</div>}
          <button type="submit" disabled={loading} style={{ width: "100%", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
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
              <label style={labelStyle}>{t.auth.newPw}</label>
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} name="new-password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ ...inputStyle, padding: t.dir === "rtl" ? "12px 14px 12px 80px" : "12px 80px 12px 14px" }} />
                <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", [t.dir === "rtl" ? "left" : "right"]: 8, top: 14, background: "transparent", border: "none", color: COLORS.gray, cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>
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
              <label style={labelStyle}>{t.auth.confirmPw}</label>
              <input type={showPassword ? "text" : "password"} name="confirm-password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading || !password} style={{ width: "100%", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
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
                <label style={labelStyle}>{t.auth.newPw}</label>
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} name="new-password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ ...inputStyle, padding: t.dir === "rtl" ? "10px 12px 10px 70px" : "10px 70px 10px 12px" }} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: "absolute", [t.dir === "rtl" ? "left" : "right"]: 8, top: 11, background: "transparent", border: "none", color: COLORS.gray, cursor: "pointer", fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>
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
                <label style={labelStyle}>{t.auth.confirmPw}</label>
                <input type={showPassword ? "text" : "password"} name="confirm-password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
              </div>
              {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12, background: "rgba(248,113,113,0.1)", padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
              <button type="submit" disabled={loading || !password} style={{ width: "100%", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
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
function TrackPage({ lang, user }) {
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
            <label style={{ color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{t.auth.email}</label>
            <input type="email" inputMode="email" autoComplete="email" value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendTrackLink(); }}
              placeholder="your@email.com"
              style={{ width: "100%", boxSizing: "border-box", background: "#111", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none", marginTop: 8, marginBottom: 16 }} />
            {guestError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{guestError}</div>}
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
        <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 8 }}>{t.track.title}</h2>
        <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.track.sub}</p>

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
              {(filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).map(order => {
                const si = getStageIndex(order.status);
                const stage = ORDER_STAGES[si] || ORDER_STAGES[0];
                const isOpen = selected === order.id;
                return (
                  <div key={order.id} style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
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
                        <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: stage.dot, boxShadow: `0 0 8px ${stage.dot}66` }}></span>{stage[lang] || stage.en}</div>
                      </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${COLORS.border}` }}>
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
                        <div style={{ marginTop: 20 }}>
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
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
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

  useEffect(() => {
    fetchOrders();
    fetchPetDesigns();
    const sub = supabase.channel("orders-changes").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders).subscribe();
    return () => sub.unsubscribe();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const fetchPetDesigns = async () => {
    const { data } = await supabase
      .from("pet_designs")
      .select("*")
      .order("sort_order", { ascending: true });
    setPetDesigns(data || []);
    setPetsLoading(false);
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

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
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
                      <div onClick={() => setSelected(isOpen ? null : order.id)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[order.status] || COLORS.accent, boxShadow: `0 0 8px ${statusColors[order.status] || COLORS.accent}`, flexShrink: 0 }} />
                          <div>
                            <div style={{ color: COLORS.white, fontWeight: 600 }}>{order.customer_name}{isMulti ? <span style={{ color: COLORS.accent, fontSize: 12, marginLeft: 8, marginRight: 8, background: "rgba(255,107,53,0.15)", padding: "2px 10px", borderRadius: 10, letterSpacing: "0.05em" }}>{group.length} {lang === "he" ? "פריטים" : lang === "ru" ? "тов." : "items"}</span> : null}</div>
                            <div style={{ color: COLORS.gray, fontSize: 13 }}>{isMulti ? group.map(o => `${localizeProduct(o.product, lang)} ×${o.quantity}`).join(" · ") : `${localizeProduct(order.product, lang)} · ${localizeVariant(order.variant, lang)} · ×${order.quantity}`}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: COLORS.accent, fontWeight: 700 }}>₪{groupTotal}</div>
                          <div style={{ color: statusColors[order.status], fontSize: 12, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: stage.dot, boxShadow: `0 0 6px ${stage.dot}66` }}></span>{stage[lang] || stage.en}</div>
                          <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{timeAgo(order.created_at, lang)}</div>
                          {order.completed_at && <div style={{ color: COLORS.success, fontSize: 11, marginTop: 2 }}>✓ {timeBetween(order.created_at, order.completed_at, lang)}</div>}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(group.map(o => o.id)); }} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: "#ef4444", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13, marginLeft: 12, flexShrink: 0, fontWeight: 700 }}>×</button>
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
                                    }} style={{ background: "rgba(255,107,53,0.1)", border: "1px solid #FF6B35", color: "#FF6B35", borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", marginLeft: 4, fontFamily: "'Varela Round',sans-serif" }}>⬇️ {d.label}</button>
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

        {/* ===== BLOOM character flags (is_bestseller / is_new) ===== */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>BLOOM</h2>
            <p style={{ color: COLORS.gray, marginTop: 4, fontSize: 13 }}>
              {petsLoading
                ? (lang === "he" ? "טוען..." : lang === "ru" ? "Загрузка..." : "Loading...")
                : `${petDesigns.length} ${lang === "he" ? "דמויות" : lang === "ru" ? "персонажей" : "characters"}`}
            </p>
          </div>

          {!petsLoading && petDesigns.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.gray, fontSize: 14 }}>
              {lang === "he" ? "אין דמויות עדיין" : lang === "ru" ? "Персонажей пока нет" : "No characters yet"}
            </div>
          )}

          {petDesigns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {petDesigns.map((d) => {
                const dName = d[`name_${lang}`] || d.name_en || d.name_he || "—";
                const thumb = d.mockup_url || d.design_url;
                return (
                  <div key={d.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: d.mockup_bg || COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {thumb && <SmartImage src={thumb} alt={dName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ color: COLORS.white, fontWeight: 600, fontFamily: "'Playfair Display',serif", flex: 1, minWidth: 120 }}>{dName}</div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Order Page
// ============ ORDER SUMMARY — sticky sidebar on desktop, collapsible top bar on mobile ============
// Lives inside step 3 of the OrderPage so the customer always sees what
// they're about to pay for, with inline qty/remove controls.
function OrderSummary({ lang, cart, setCart, updateCartQty, isMobile }) {
  const isRTL = lang === "he";
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
  const shipping = cart.length > 0 ? SHIPPING_PRICE : 0;
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
  const products = PRODUCTS(t);
  const [step, setStep] = useState((pendingBloomItem || pendingCheckout) ? 3 : 1);
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
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrderGroupId, setPendingOrderGroupId] = useState(null);
  const [pendingOrderIds, setPendingOrderIds] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPaymentSoonModal, setShowPaymentSoonModal] = useState(false);
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
  const fileRef = useRef();
  const mockupRef = useRef();
  const mockupImageRef = useRef();
  const pinchRef = useRef(null);
  // Refs for native touch handlers (needed for passive:false)
  const touchHandlersRef = useRef({});

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

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
  const total = (cartItemsTotal + currentItemTotal) + (hasOrderInProgress ? SHIPPING_PRICE : 0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
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
    if (!form.name || !form.email || !form.phoneNumber || form.phoneNumber.length !== 7 || !form.street || !form.city || !form.postalCode) return;
    if (cart.length === 0) return;
    setSubmitting(true);
    const phone = form.phoneNumber ? `${form.phonePrefix}-${form.phoneNumber}` : "";
    const orderGroupId = `grp-${Date.now()}`;

    try {
      const createdOrderIds = [];
      for (let i = 0; i < cart.length; i++) {
        const it = cart[i];
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

        const itemTotal = it.itemPrice + (i === 0 ? SHIPPING_PRICE : 0);

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

      // Fire order-confirmation + admin-alert emails exactly once, right after the
      // orders insert succeeds. Non-blocking: failures are logged but never block
      // the checkout flow. Moved out of the payment-soon modal CTA so the email
      // sends regardless of how that modal is closed.
      const confirmedTotal = cartItemsTotal + SHIPPING_PRICE;
      Promise.all([
        supabase.functions.invoke(`send-order-confirmation`, {
          body: {
            customerName: form.name,
            customerEmail: form.email,
            product: cart.map(c => c.productName).join(`, `),
            variant: `${cart.length} items`,
            quantity: cart.reduce((s, c) => s + c.qty, 0),
            total: confirmedTotal,
            orderId: orderGroupId,
            orderGroup: orderGroupId,
            language: lang,
          },
        }),
        supabase.functions.invoke(`send-admin-order-alert`, {
          body: { orderGroup: orderGroupId },
        }),
      ]).catch(emailErr => console.error(`Order email send failed:`, emailErr));

      // Save context for the payment step.
      setPendingOrderGroupId(orderGroupId);
      setPendingOrderIds(createdOrderIds);
      setPendingTotal(confirmedTotal);

      allowLeaveRef.current = true;
      setStep(4);
    } catch (e) {
      alert(`Error: ${e.message || e}`);
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
      <div style={{ maxWidth: step === 3 ? 1100 : 700, margin: "0 auto", padding: "24px 24px 60px", transition: "max-width 0.25s ease" }}>
        <div style={{ display: "flex", marginBottom: 40 }}>
          {t.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step >= i + 1 ? COLORS.accent : COLORS.bgCard, border: `2px solid ${step >= i + 1 ? COLORS.accent : COLORS.border}`, color: step >= i + 1 ? "#fff" : COLORS.gray, fontSize: 13, fontWeight: 600 }}>{step > i + 1 ? "✓" : i + 1}</div>
              <div style={{ fontSize: 11, color: step === i + 1 ? COLORS.accent : COLORS.gray, marginTop: 6 }}>{s}</div>
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
                }} style={{ background: COLORS.accent, border: "none", color: "#fff", borderRadius: 10, padding: "14px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 700, fontSize: 15, boxShadow: "0 4px 16px rgba(255,107,53,0.3)" }}>
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
                    {lang === "he" ? "סה״כ:" : lang === "ru" ? "Итого:" : "Total:"} ₪{cartItemsTotal + SHIPPING_PRICE}
                  </div>
                </div>
                <button onClick={() => setStep(3)} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontFamily: "'Varela Round',sans-serif", fontSize: 13 }}>
                  {lang === "he" ? "לתשלום" : lang === "ru" ? "К оплате" : "Checkout"} →
                </button>
              </div>
            )}
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.product.title}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 20 }}>{t.product.sub}</p>
            <div style={{ marginBottom: 24 }}>
              <TrustRow lang={lang} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {products.map((p, idx) => (
                <div key={p.id} onClick={() => { setSelectedProduct(p.id); setSelectedVariant(p.variants[0].id); setSelectedColor(0); setUploadedImage(null); }}
                  style={{ background: selectedProduct === p.id ? "rgba(255,107,53,0.1)" : COLORS.bgCard, border: `2px solid ${selectedProduct === p.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: isMobile ? "16px 16px" : "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 18, flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 18 : 22, fontStyle: "italic", color: selectedProduct === p.id ? COLORS.accent : "#555", minWidth: isMobile ? 22 : 32, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                    <div style={{ width: isMobile ? 44 : 54, height: isMobile ? 44 : 54, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SmartImage src={MOCKUP_URLS[p.id]} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ color: COLORS.white, fontWeight: 600, fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 16 : 18 }}>{p.name}</span>
                        {p.is_bestseller && <span style={{ background: COLORS.accent, color: "#fff", fontFamily: "'Varela Round',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4 }}>{LANGS[lang].badges.bestseller}</span>}
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
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.customize.title(product.name)}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 24 }}>{t.customize.sub}</p>
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
                                <button onClick={() => nudge(-5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>←</button>
                                <div style={{ background: COLORS.bg, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 10, color: COLORS.gray }}>✛</span></div>
                                <button onClick={() => nudge(5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "8px", cursor: "pointer", fontSize: 14, fontFamily: "'Varela Round',sans-serif" }}>→</button>
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
                  <label style={labelStyle}>{["tshirt","oversized","dryfit"].includes(product.id) ? t.customize.size : t.customize.option}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.variants.map(v => <button key={v.id} onClick={() => setSelectedVariant(v.id)} style={{ background: selectedVariant === v.id ? COLORS.accent : COLORS.bgCard, border: `1px solid ${selectedVariant === v.id ? COLORS.accent : COLORS.border}`, color: selectedVariant === v.id ? "#fff" : COLORS.white, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 500, transition: "all 0.15s" }}>{v.label}</button>)}
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
                      <div key={i} onClick={() => setSelectedColor(i)}
                        title={colorName(c, lang)}
                        aria-label={colorName(c, lang)}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: `3px solid ${selectedColor === i ? COLORS.accent : "transparent"}`, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)", transition: "transform 0.15s", transform: selectedColor === i ? "scale(1.2)" : "scale(1)" }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t.customize.design}</label>
                  <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${uploadedImage ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer" }} onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent} onMouseOut={e => e.currentTarget.style.borderColor = uploadedImage ? COLORS.accent : COLORS.border}>
                    {uploadedImage ? <><img src={uploadedImage} alt={lang === "he" ? "תצוגה מקדימה של העיצוב שהועלה" : lang === "ru" ? "Предпросмотр загруженного дизайна" : "Uploaded design preview"} style={{ width: 50, height: 50, objectFit: "contain", borderRadius: 6, marginBottom: 6 }} /><div style={{ color: COLORS.accent, fontSize: 12 }}>{t.customize.uploaded}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.changeFile}</div></> : <><div style={{ fontSize: 24, marginBottom: 6 }}>📁</div><div style={{ color: COLORS.white, fontSize: 13 }}>{t.customize.uploadTitle}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.uploadSub}</div></>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
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
                          <button onClick={() => nudge(-5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>←</button>
                          <div style={{ background: COLORS.bg, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, color: COLORS.gray }}>✛</span></div>
                          <button onClick={() => nudge(5, 0)} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 6, padding: "10px", cursor: "pointer", fontSize: 16, fontFamily: "'Varela Round',sans-serif" }}>→</button>
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
                {["tshirt","oversized","dryfit"].includes(product.id) && (
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
                  <label style={labelStyle}>{t.form.notes}</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t.form.notesPh} rows={2} style={{ width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 13, outline: "none", resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
                {variant && <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 14, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{product.name}</span><span>₪{variant.price}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{t.customize.shipping}</span><span>₪{SHIPPING_PRICE}</span></div>
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
            {isMobile && <OrderSummary lang={lang} cart={cart} setCart={setCart} updateCartQty={updateCartQty} isMobile={true} />}

            {/* Form column — wider on desktop (flex 1.5 vs sidebar's 1) */}
            <div style={{ flex: isMobile ? "none" : "1.5", width: "100%", minWidth: 0 }}>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.form.title}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.form.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div><label style={labelStyle}>{t.form.name}</label><input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t.form.namePh} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div><label style={labelStyle}>{t.form.email}</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t.form.emailPh} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div>
                <label style={labelStyle}>{t.form.phone}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, direction: "ltr", marginBottom: 10 }}>
                  {IL_PREFIXES.map(pf => <button key={pf.value} type="button" onClick={() => setForm(p => ({ ...p, phonePrefix: pf.value }))} style={{ background: form.phonePrefix === pf.value ? "rgba(255,107,53,0.15)" : "#1a1a1a", border: `1px solid ${form.phonePrefix === pf.value ? "#FF6B35" : "#2a2a2a"}`, color: form.phonePrefix === pf.value ? "#FF6B35" : "#888", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Varela Round',sans-serif", transition: "all 0.15s" }}>{pf.value}</button>)}
                </div>
                <input type="tel" placeholder={t.form.phonePh} value={form.phoneNumber} maxLength={7} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") }))} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>{lang === "he" ? "כתובת מלאה — רחוב ומספר" : lang === "ru" ? "Адрес — улица и номер" : "Address — Street & number"}</label>
                <input type="text" value={form.street} onChange={e => { const v = e.target.value; setForm(p => ({ ...p, street: v })); fetchAddrSuggestions(`${v}${form.city ? `, ${form.city}` : ", Israel"}`); }} onBlur={() => setTimeout(() => setShowAddrSugg(false), 200)} placeholder={lang === "he" ? "לדוגמה: הרצל 15" : lang === "ru" ? "Например: Герцль 15" : "e.g. Herzl 15"} style={inputStyle} autoComplete="off" />
                {addrLoading && <div style={{ position: "absolute", left: 14, top: 38, color: COLORS.gray, fontSize: 11 }}>⏳</div>}
                {showAddrSugg && addrSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: COLORS.bgCard, border: `1px solid ${COLORS.accent}`, borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto", zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                    {addrSuggestions.map((s, i) => (
                      <div key={i} onMouseDown={(e) => { e.preventDefault(); selectAddress(s); }} style={{ padding: "10px 14px", cursor: "pointer", color: COLORS.white, fontSize: 13, borderBottom: i < addrSuggestions.length - 1 ? `1px solid ${COLORS.border}` : "none", fontFamily: "'Varela Round',sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,107,53,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ color: COLORS.accent, fontWeight: 600 }}>{s.display_name.split(",").slice(0, 2).join(",")}</div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{s.display_name.split(",").slice(2).join(",").trim()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{lang === "he" ? "עיר" : lang === "ru" ? "Город" : "City"}</label>
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder={lang === "he" ? "תל אביב" : lang === "ru" ? "Тель-Авив" : "Tel Aviv"} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{lang === "he" ? "מיקוד" : lang === "ru" ? "Индекс" : "Postal Code"}</label>
                  <input type="text" value={form.postalCode} maxLength={7} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value.replace(/\D/g, "") }))} placeholder="1234567" style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
                </div>
              </div>
              <div><label style={labelStyle}>{t.form.notes}</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t.form.notesPh} rows={3} style={{ ...inputStyle, resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div style={{ background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.2)`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>{t.form.paymentNote}</div>
                <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 4 }}>{t.form.paymentSub}</div>
              </div>
            </div>
            {(() => {
              const missing = [];
              if (!form.name) missing.push(lang === "he" ? "שם" : lang === "ru" ? "Имя" : "Name");
              if (!form.email) missing.push(lang === "he" ? "אימייל" : lang === "ru" ? "Email" : "Email");
              if (!form.phoneNumber || form.phoneNumber.length !== 7) missing.push(lang === "he" ? "טלפון (7 ספרות)" : lang === "ru" ? "Телефон (7 цифр)" : "Phone (7 digits)");
              if (!form.street) missing.push(lang === "he" ? "כתובת" : lang === "ru" ? "Адрес" : "Address");
              if (!form.city) missing.push(lang === "he" ? "עיר" : lang === "ru" ? "Город" : "City");
              if (!form.postalCode) missing.push(lang === "he" ? "מיקוד" : lang === "ru" ? "Индекс" : "Postal Code");
              if (missing.length === 0) return null;
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
                <OrderSummary lang={lang} cart={cart} setCart={setCart} updateCartQty={updateCartQty} isMobile={false} />
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
              <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 34, marginBottom: 6 }}>{t.payment.title}</h2>
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
                  <span>₪{SHIPPING_PRICE}</span>
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

            {/* Pay button - the most prominent element */}
            <MagneticButton
              block
              strength={0.25}
              radius={24}
              onClick={() => setShowPaymentSoonModal(true)}
              disabled={paymentProcessing}
              style={{
                width: "100%",
                background: paymentProcessing ? COLORS.bgCard : `linear-gradient(135deg, ${COLORS.accent} 0%, #FF8855 100%)`,
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
              <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.05em" }}>
                {t.payment.acceptedCards} VISA · Mastercard · Bit · Apple Pay · Google Pay
              </div>
              <div style={{ color: "#555", fontSize: 10.5, marginTop: 6 }}>
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
                    alert(`Error: ${e.message || e}`);
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
            {showPaymentSoonModal && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, backdropFilter: "blur(4px)" }}>
                <div style={{ background: "#1a1a1a", border: `1px solid ${COLORS.accent}`, borderRadius: 16, padding: "36px 32px", maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(255,107,53,0.2)" }}>
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
                    onClick={() => {
                      // Emails already fired when the order was inserted (in handleSubmit) —
                      // this CTA just acknowledges the modal and advances to confirmation.
                      setShowPaymentSoonModal(false);
                      setCart([]);
                      setStep(5);
                    }}
                    style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", width: "100%" }}
                  >
                    {t.payment.soonBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: "center", padding: "20px 0 60px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid #22c55e", marginBottom: 24, fontSize: 44 }}>✓</div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 8 }}>{t.confirm.title}</h2>
            <p style={{ color: COLORS.gray, fontSize: 15, marginBottom: 24 }}>{t.confirm.subtitle}</p>

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
              {user && <button onClick={() => setPage("track")} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.track} →</button>}
              <button onClick={() => { setStep(1); setSelectedProduct(null); setUploadedImage(null); setForm({ name: "", email: "", phonePrefix: "050", phoneNumber: "", street: "", city: "", postalCode: "", notes: "" }); setQty(1); setPendingOrderGroupId(null); setPendingOrderIds([]); setPendingTotal(0); }} style={{ background: "transparent", color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "14px 28px", fontSize: 15, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.another}</button>
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
    <div role="dialog" aria-label="Cookie consent" style={{
      position: "fixed",
      bottom: 16,
      left: 16,
      right: 16,
      maxWidth: 720,
      margin: "0 auto",
      background: "rgba(15,15,15,0.96)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,107,53,0.25)",
      borderRadius: 16,
      padding: "20px 24px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,107,53,0.08)",
      zIndex: 9999,
      direction: isRTL ? "rtl" : "ltr",
      animation: "cookieRise 0.5s cubic-bezier(.2,.7,.2,1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF6B35", boxShadow: "0 0 12px rgba(255,107,53,0.6)" }}></span>
        <div style={{ color: "#FF6B35", fontFamily: "'Playfair Display',serif", fontSize: 14, fontStyle: "italic", letterSpacing: "0.5px" }}>{t.title}</div>
      </div>
      <p style={{ color: "#bbb", fontFamily: "'Varela Round',sans-serif", fontSize: 13, lineHeight: 1.65, marginBottom: 16, marginTop: 0 }}>
        {t.body}
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const isMobile = window.matchMedia('(hover: none)').matches || window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 30 : 75;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Dot particles
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: i < 8 ? Math.random() * 3 + 2 : i < 25 ? Math.random() * 1.5 + 0.8 : Math.random() * 0.8 + 0.2,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: i < 8 ? Math.random() * 0.35 + 0.15 : Math.random() * 0.2 + 0.05,
      color: i < 12 ? '#FF6B35' : i < 22 ? '#ff8c5a' : '#ffffff',
      pulse: Math.random() * Math.PI * 2,
    }));

    // Ambient glowing orbs — large, soft, drifting (premium feel)
    const orbs = [
      { baseX: 0.2, baseY: 0.3, baseR: 320, color: '255, 107, 53', alpha: 0.10, speed: 0.00018, phase: 0 },
      { baseX: 0.8, baseY: 0.7, baseR: 280, color: '255, 140, 90', alpha: 0.08, speed: 0.00022, phase: Math.PI / 2 },
      { baseX: 0.5, baseY: 0.15, baseR: 240, color: '255, 107, 53', alpha: 0.06, speed: 0.00028, phase: Math.PI },
      { baseX: 0.1, baseY: 0.9, baseR: 360, color: '230, 80, 35', alpha: 0.07, speed: 0.00016, phase: Math.PI * 1.5 },
      { baseX: 0.7, baseY: 0.5, baseR: 200, color: '255, 200, 150', alpha: 0.045, speed: 0.00032, phase: Math.PI / 3 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t2 = Date.now() / 1000;
      const tMs = Date.now();

      // Ambient orbs — soft glowing background atmosphere
      ctx.globalCompositeOperation = 'lighter';
      orbs.forEach(o => {
        const driftX = Math.sin(tMs * o.speed + o.phase) * 70;
        const driftY = Math.cos(tMs * o.speed * 0.7 + o.phase) * 50;
        const cx = canvas.width * o.baseX + driftX;
        const cy = canvas.height * o.baseY + driftY;
        const radius = o.baseR + Math.sin(t2 * 0.4 + o.phase) * 25;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(${o.color}, ${o.alpha})`);
        gradient.addColorStop(0.45, `rgba(${o.color}, ${o.alpha * 0.35})`);
        gradient.addColorStop(1, `rgba(${o.color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
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

      // Connections between nearby particles — skipped on mobile for perf
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
      animId = requestAnimationFrame(draw);
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
  }, []);

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
        {reviews.map((r) => (
          <article key={r.id} className="reveal" aria-label={t.aria} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: isMobile ? "20px 18px" : "26px 24px", display: "flex", flexDirection: "column", gap: 12, transition: "border-color 0.25s, transform 0.25s" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-4px)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; }}>
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
    <div style={{ position: "absolute", top: 10, [isRTL ? "right" : "left"]: 10, display: "flex", flexDirection: "column", gap: 6, zIndex: 3, pointerEvents: "none" }}>
      {showBest && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: COLORS.accent, color: "#fff", fontFamily: "'Varela Round',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 6, boxShadow: "0 4px 12px rgba(255,107,53,0.35)", whiteSpace: "nowrap" }}>
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
  const products = PRODUCTS(t);
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
  const gridCols = vw >= 768 ? "repeat(3, 1fr)" : vw >= 480 ? "repeat(2, 1fr)" : "1fr";
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 120px", direction: t.dir, background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 60%), ${COLORS.bg}` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", transform: `translateY(${pText}px)`, willChange: "transform" }}>
      <div className="reveal" style={{ display: "inline-block", background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 100, padding: "6px 18px", marginBottom: 24, color: COLORS.accent, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Varela Round',sans-serif" }}>{t.hero.badge}</div>
      <h1 className="reveal" data-delay="1" style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(36px,8vw,90px)", fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: "-2px", color: COLORS.white }}>
        {t.hero.h1line1}<br /><span style={{ color: COLORS.accent, fontStyle: "italic" }}>{t.hero.h1line2}</span>
      </h1>
      <p className="reveal" data-delay="2" style={{ color: COLORS.gray, fontSize: 18, maxWidth: 480, lineHeight: 1.7, marginBottom: 40, fontFamily: "'Varela Round',sans-serif", fontWeight: 300 }}>{t.hero.sub}</p>
      <span className="reveal" data-delay="3" style={{ display: "inline-flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        <MagneticButton onClick={() => setPage("order")} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "16px 36px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "background 0.2s, box-shadow 0.3s" }} onMouseOver={e => e.target.style.background = COLORS.accentHover} onMouseOut={e => e.target.style.background = COLORS.accent}>{t.hero.cta}</MagneticButton>
        <button onClick={() => setPage("pets")} style={{ background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, padding: "16px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Playfair Display',serif", fontStyle: "italic", letterSpacing: "0.3px", transition: "background 0.2s, color 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}
        >{t.hero.ctaSecondary} →</button>
      </span>
      <div className="reveal" data-delay="4" style={{ marginTop: isMobile ? 48 : 64, width: "100%", maxWidth: 720, padding: "0 8px", boxSizing: "border-box" }}>
        <TrustRow lang={lang} />
      </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 20, marginTop: isMobile ? 32 : 48, width: "100%", maxWidth: vw >= 768 ? 820 : 420, transform: `translateY(${pCards}px)`, willChange: "transform" }}>
        {products.map((p, idx) => (
          <div key={p.id} onClick={() => setPage("order")} className="reveal" data-delay={String(Math.min(idx + 1, 6))}
            style={{ position: "relative", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: isMobile ? "24px 24px" : "28px 32px", cursor: "pointer", transition: "border-color 0.2s, transform 0.3s, box-shadow 0.3s, opacity 0.75s cubic-bezier(.2,.6,.2,1)" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-8px)"; e.currentTarget.style.boxShadow = `0 20px 40px rgba(255,107,53,0.15)`; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <ProductBadges product={p} lang={lang} />
            <div style={{ width: "100%", height: 130, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SmartImage src={MOCKUP_URLS[p.id]} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
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
function Nav({ page, setPage, lang, setLang, user, isAdmin, onLogout, cartCount, onCartClick }) {
  const t = LANGS[lang];
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // Trigger a one-shot scale bump on the badge whenever cartCount goes up,
  // so the user gets visual confirmation that an item was just added.
  const [bumpKey, setBumpKey] = useState(0);
  const prevCountRef = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCountRef.current) setBumpKey(k => k + 1);
    prevCountRef.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

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
        <span key={bumpKey} className="cart-badge-bump" style={{ position: "absolute", top: -7, right: -7, minWidth: 19, height: 19, padding: "0 5px", boxSizing: "border-box", borderRadius: 10, background: COLORS.accent, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${COLORS.bg}` }}>{cartCount}</span>
      )}
    </button>
  );

  // Instagram icon link — square button, matches the cart button's style.
  const instagramButton = (
    <a href="https://www.instagram.com/sfalimshop/" target="_blank" rel="noopener noreferrer" aria-label="אינסטגרם"
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

  return (
    <>
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.95)", backdropFilter: "blur(24px)", borderBottom: `1px solid rgba(255,107,53,0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "0 16px" : "0 32px", height: 72, direction: "ltr", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
      {/* Logo - LEFT */}
      <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setPage("home")}>
        <img src="/logo.jpg" alt="Sfalim Shop" style={{ height: isMobile ? 40 : 58, width: "auto", maxWidth: isMobile ? 160 : 280, mixBlendMode: "screen" }} /></div>

      {/* Nav links - CENTER (desktop only) */}
      {!isMobile && <div style={{ display: "flex", gap: 4, alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        {["home", "order", "pets", "about"].map(p => (
          <button key={p} onClick={() => setPage(p)} style={{
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
        {user && (
          <button onClick={() => setPage("track")} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
          onMouseOver={e => { if(page !== "track") { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== "track") { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
          >{t.nav.track}</button>
        )}
        {isAdmin && (
          <button onClick={() => setPage("admin")} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}>{t.nav.admin}</button>
        )}
      </div>}

      {/* Lang + Hamburger - MOBILE RIGHT */}
      {isMobile && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {cartButton}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accent : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
          ))}
        </div>
        <button onClick={() => setMobileMenu(m => !m)} style={{ background: mobileMenu ? COLORS.accentDim : "transparent", border: `1px solid ${mobileMenu ? COLORS.accent : COLORS.border}`, color: COLORS.white, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 22, lineHeight: 1, transition: "all 0.2s" }}>{mobileMenu ? "✕" : "☰"}</button>
      </div>}

      {/* Auth + Lang - RIGHT (desktop only) */}
      {!isMobile && <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {cartButton}
        {instagramButton}
        {user ? (
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.gray; }}
          >{t.nav.logout}</button>
        ) : (
          <button onClick={() => setPage("auth")} style={{ background: COLORS.accent, border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: "0 0 20px rgba(255,107,53,0.3)" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentHover; e.currentTarget.style.boxShadow = "0 0 30px rgba(255,107,53,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseOut={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.boxShadow = "0 0 20px rgba(255,107,53,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >{t.nav.login}</button>
        )}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accent : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
          ))}
        </div>
      </div>}
    </nav>

    {/* Mobile dropdown */}
    {mobileMenu && (
      <div style={{ position: "fixed", top: 72, left: 0, right: 0, zIndex: 99, background: "rgba(15,15,15,0.98)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {["home", "order", "pets", "about"].map(p => (
          <button key={p} onClick={() => { setPage(p); setMobileMenu(false); }} style={{ background: page === p ? COLORS.accentDim : "transparent", border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === p ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: p === "pets" ? "'Playfair Display',serif" : "'Varela Round',sans-serif", fontSize: 16, fontWeight: p === "pets" ? 700 : 500, fontStyle: p === "pets" ? "italic" : "normal", textAlign: "left", width: "100%" }}>{t.nav[p]}</button>
        ))}
        {user && <button onClick={() => { setPage("track"); setMobileMenu(false); }} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, textAlign: "left", width: "100%" }}>{t.nav.track}</button>}
        {isAdmin && <button onClick={() => { setPage("admin"); setMobileMenu(false); }} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.white, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, textAlign: "left", width: "100%" }}>{t.nav.admin}</button>}
        <div style={{ height: 1, background: COLORS.border, margin: "8px 0" }} />
        {user
          ? <button onClick={() => { onLogout(); setMobileMenu(false); }} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, width: "100%" }}>{t.nav.logout}</button>
          : <button onClick={() => { setPage("auth"); setMobileMenu(false); }} style={{ background: COLORS.accent, border: "none", color: "#fff", padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, width: "100%" }}>{t.nav.login}</button>
        }
        <a href="https://www.instagram.com/sfalimshop/" target="_blank" rel="noopener noreferrer" aria-label="אינסטגרם"
          onClick={() => setMobileMenu(false)}
          style={{ background: "transparent", border: `1px solid ${COLORS.accent}`, color: COLORS.accent, padding: "14px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 16, fontWeight: 700, width: "100%", boxSizing: "border-box", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.color = "#fff"; }}
          onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.accent; }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
          <span>אינסטגרם</span>
        </a>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => { setLang(l); setMobileMenu(false); }} style={{ background: lang === l ? COLORS.accent : COLORS.bgCard, color: lang === l ? "#fff" : COLORS.gray, border: `1px solid ${lang === l ? COLORS.accent : COLORS.border}`, borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Varela Round',sans-serif" }}>{LANGS[l].label}</button>
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

  // Cart drawer slides in from inline-end (right in LTR, left in RTL). Anchor
  // the a11y button to inline-start so the two never share the same edge.
  // On mobile the cart is full-width, so just hide the button while it's open.
  if (cartOpen && isMobile) return null;

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.body.style.filter = 'contrast(1.4) brightness(1.1)';
    } else {
      document.body.style.filter = 'none';
    }
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

  const t = {
    he: { title: 'נגישות', textSize: 'גודל טקסט', contrast: 'ניגודיות גבוהה', motion: 'הפחת אנימציות', reset: 'איפוס', close: 'סגור' },
    en: { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' },
    ru: { title: 'Доступность', textSize: 'Размер текста', contrast: 'Высокий контраст', motion: 'Без анимации', reset: 'Сбросить', close: 'Закрыть' },
  }[lang] || { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' };

  const btnBase = { width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.2s', marginBottom: 8 };

  return (
    <>
      {/* Accessibility button — fixed at the bottom inline-start corner so it
          always sits on the opposite side from the cart drawer. */}
      <button
        aria-label="Accessibility menu"
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
        <div style={{
          position: 'fixed', bottom: 88, insetInlineStart: 24, zIndex: 9997,
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 16, padding: 20, width: 260,
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
              <button onClick={() => setFontSize(f => Math.max(80, f - 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>−</button>
              <div style={{ flex: 1, textAlign: 'center', color: '#FF6B35', fontWeight: 700, fontFamily: "'Varela Round',sans-serif" }}>{fontSize}%</div>
              <button onClick={() => setFontSize(f => Math.min(140, f + 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>+</button>
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
          <button onClick={() => { setFontSize(100); setHighContrast(false); setReduceMotion(false); }} style={{ ...btnBase, background: 'transparent', border: '1px solid #2a2a2a', color: '#555', textAlign: 'center', marginBottom: 0 }}>
            {t.reset}
          </button>
        </div>
      )}
    </>
  );
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
                <div style={{ color: '#555', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
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
function CartToast({ message, lang, onClose, onViewCart }) {
  const isRTL = lang === "he";
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  const viewLabel = lang === "he" ? "צפה בסל" : lang === "ru" ? "Открыть корзину" : "View cart";
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
      <button onClick={onViewCart} type="button" style={{
        background: COLORS.accent, border: "none", color: "#fff",
        padding: isMobile ? "10px 14px" : "8px 14px",
        borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
        fontFamily: "'Varela Round',sans-serif", flexShrink: 0,
        minHeight: isMobile ? 40 : "auto", touchAction: "manipulation",
        transition: "background 0.2s",
      }}
      onMouseOver={e => e.currentTarget.style.background = COLORS.accentHover}
      onMouseOut={e => e.currentTarget.style.background = COLORS.accent}
      >{viewLabel}</button>
      {!isMobile && (
        <button onClick={onClose} type="button" aria-label="dismiss" style={{
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

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.6)",
        animation: "cartFade 0.25s ease",
      }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, bottom: 0,
        [isRTL ? "left" : "right"]: 0,
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
          <div style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700 }}>
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
            <button onClick={onCheckout} style={{
              width: "100%", background: COLORS.accent, color: "#fff", border: "none",
              borderRadius: 12, padding: isMobile ? "16px" : "15px", fontSize: 16, fontWeight: 700, cursor: "pointer",
              fontFamily: "'Varela Round',sans-serif", boxShadow: "0 6px 20px rgba(255,107,53,0.35)",
              transition: "background 0.2s", touchAction: "manipulation",
            }}
            onMouseOver={e => e.currentTarget.style.background = COLORS.accentHover}
            onMouseOut={e => e.currentTarget.style.background = COLORS.accent}
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
}

export default function App() {
 const VALID_PAGES = ['home', 'order', 'track', 'auth', 'admin', 'about', 'pets', 'policies', 'reset-password', ...(MUG_STUDIO_ENABLED ? ['mug-studio'] : [])];

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
    const hash = window.location.hash.replace('#', '');
    const root = hash.split('/')[0];
    return VALID_PAGES.includes(root) ? root : 'home';
  };

  const getPageFromHash = getPageFromURL;

  const [page, setPageState] = useState(getPageFromURL);
  const [lang, setLang] = useState("he");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingBloomItem, setPendingBloomItem] = useState(null);
  // The order cart lives here (not inside OrderPage) so it survives navigation
  // between the BLOOM collection and the order page while shopping.
  const [cart, setCart] = useState([]);
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
    setCartToast(tmpl);
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    cartToastTimer.current = setTimeout(() => setCartToast(null), 3000);
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
    setCartToast(tmpl);
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    cartToastTimer.current = setTimeout(() => setCartToast(null), 3000);
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
    };
    window.addEventListener('popstate', handlePopState);
    // Set initial history state
    const current = getPageFromHash();
    window.history.replaceState({ page: current }, '', window.location.href);
    return () => window.removeEventListener('popstate', handlePopState);
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

    // Small delay to let DOM mount after page change
    const timer = setTimeout(() => {
      document.querySelectorAll(".reveal:not(.revealed)").forEach(el => observer.observe(el));
    }, 50);

    // Safety net: force-reveal anything still hidden after 1.5s
    // Prevents the "empty page on refresh" bug when observer fails to fire
    const safetyTimer = setTimeout(() => {
      document.querySelectorAll(".reveal:not(.revealed)").forEach(el => el.classList.add("revealed"));
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
      observer.disconnect();
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
        policies: "מידע משפטי | ספלים שופ",
      },
      en: {
        home:     "Sfalim Shop | Custom Prints — Shirts, Mugs, Stickers",
        order:    "Design Your Order | Sfalim Shop",
        pets:     "BLOOM Collection | Pet Couture by Sfalim Shop",
        about:    "About Sfalim Shop",
        track:    "Track Orders | Sfalim Shop",
        admin:    "Admin | Sfalim Shop",
        policies: "Legal | Sfalim Shop",
      },
      ru: {
        home:     "Sfalim Shop | Индивидуальная печать — футболки, кружки, стикеры",
        order:    "Создать заказ | Sfalim Shop",
        pets:     "BLOOM Collection | Pet Couture от Sfalim Shop",
        about:    "О Sfalim Shop",
        track:    "Отслеживание заказов | Sfalim Shop",
        admin:    "Админ | Sfalim Shop",
        policies: "Правовая информация | Sfalim Shop",
      },
    };
    const langTitles = titles[lang] || titles.he;
    document.title = langTitles[page] || langTitles.home;
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Varela+Round&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

        /* WCAG 2.4.7 — visible keyboard focus. Mouse clicks suppressed via :focus-visible. */
        :focus { outline: none; }
        :focus-visible { outline: 2px solid #FF6B35 !important; outline-offset: 2px !important; }
        input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible { outline: 2px solid #FF6B35 !important; outline-offset: 2px !important; }

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

        /* ============ SCROLL REVEAL — fade up on intersection ============ */
        .reveal {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.75s cubic-bezier(.2,.6,.2,1), transform 0.75s cubic-bezier(.2,.6,.2,1);
          will-change: opacity, transform;
        }
        .reveal.revealed { opacity: 1; transform: translateY(0); will-change: auto; }
        .reveal[data-delay="1"] { transition-delay: 0.08s; }
        .reveal[data-delay="2"] { transition-delay: 0.16s; }
        .reveal[data-delay="3"] { transition-delay: 0.24s; }
        .reveal[data-delay="4"] { transition-delay: 0.32s; }
        .reveal[data-delay="5"] { transition-delay: 0.4s; }
        .reveal[data-delay="6"] { transition-delay: 0.48s; }
        @media (prefers-reduced-motion: reduce) {
          .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
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
        const isStaffOverride = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("staff") === "1";
        // Maintenance gate. Only 'policies' is exposed during maintenance
        // (legal pages need to stay reachable for Google verification + SEO).
        // The previous mug-studio exception is removed — that route is now
        // controlled by MUG_STUDIO_ENABLED above and respects MAINTENANCE_MODE.
        if (MAINTENANCE_MODE && !isAdmin && !isStaffOverride && page !== 'policies') {
          return <MaintenancePage lang={lang} setLang={setLang} setPage={setPage} />;
        }
        return (
          <>
            <AccessibilityMenu lang={lang} cartOpen={cartOpen} reduceMotion={reduceMotion} setReduceMotion={setReduceMotion} />
            <Nav page={page} setPage={setPage} lang={lang} setLang={setLang} user={user} isAdmin={isAdmin} onLogout={handleLogout} cartCount={cart.reduce((s, it) => s + (it.qty || 1), 0)} onCartClick={openCart} />
            {page === "home" && <><HomeFloatingBloomCarousel lang={lang} setPage={setPage} /><Hero setPage={setPage} lang={lang} /><Reviews lang={lang} /></>}
            {page === "about" && <AboutPage lang={lang} setPage={setPage} />}
            {page === "pets" && <PetsPage lang={lang} setPage={setPage} onOrderBloom={addBloomToCart} />}
            {page === "order" && <OrderPage lang={lang} user={user} setPage={setPage} pendingBloomItem={pendingBloomItem} clearPendingBloomItem={() => setPendingBloomItem(null)} cart={cart} setCart={setCart} updateCartQty={updateCartQty} pendingCheckout={pendingCheckout} clearPendingCheckout={() => setPendingCheckout(false)} />}
            {page === "track" && <TrackPage lang={lang} user={user} />}
            {page === "auth" && <AuthPage lang={lang} onAuth={handleAuth} />}
            {page === "admin" && isAdmin && <AdminPage lang={lang} />}
            {page === "admin" && !isAdmin && <Hero setPage={setPage} lang={lang} />}
            {page === "policies" && <PoliciesPage lang={lang} />}
            {page === "reset-password" && <ResetPasswordPage lang={lang} setPage={setPage} />}
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
            <Footer lang={lang} setPage={setPage} />
            <CartDrawer lang={lang} open={cartOpen} cart={cart} setCart={setCart} updateCartQty={updateCartQty} onClose={closeCart} onCheckout={goToCheckout} />
            {/* "Added to cart" toast — 3s, bottom-sheet style on mobile,
                top-corner pill on desktop. Action button opens the cart drawer. */}
            {cartToast && <CartToast message={cartToast} lang={lang} onClose={() => setCartToast(null)} onViewCart={() => { setCartToast(null); openCart(); }} />}
            <style>{`
              @keyframes cartToastInDesktop { from { opacity: 0; transform: translateX(${lang === "he" ? "100%" : "-100%"}); } to { opacity: 1; transform: translateX(0); } }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

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
      alpha: Math.random() * 0.06 + 0.03,
      color: Math.random() > 0.5 ? "#FF6B35" : "#ff8c5a",
    }));

    const draw = () => {
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
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 0,
    }} />
  );
}

// ============ PETS PAGE — BLOOM Collection / Pet Couture ============
function PetsPage({ lang, setPage, onOrderBloom }) {
  const isRTL = lang === "he";
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // currently opened character in modal
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const pHero = useParallax(0.18);
  const pOrb1 = useParallax(0.4);
  const pOrb2 = useParallax(-0.3);
  const pTitle = useParallax(0.35);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  // Fetch the collection
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pet_designs")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        setDesigns(data || []);
      } catch (err) {
        console.error("Failed to load BLOOM collection:", err);
      } finally {
        setLoading(false);
      }
    })();
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
        const prices = [d.price_sticker, d.price_mug, d.price_shirt]
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

  // URL-shareable BLOOM characters: #pets/<slug> opens that character.
  // Slug is derived from English name (locale-independent so links are stable).
  const slugify = (d) => {
    const name = (d?.name_en || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return name || (d?.id != null ? String(d.id) : "");
  };

  // Read the URL hash and open the matching character — or fall back to the grid view.
  useEffect(() => {
    if (!designs.length) return;
    const applyHash = () => {
      const hash = (window.location.hash || "").replace("#", "");
      const parts = hash.split("/");
      if (parts[0] !== "pets") return;
      const slug = parts[1];
      if (!slug) { setSelected(null); return; }
      const match = designs.find(d => slugify(d) === slug);
      if (match) {
        setSelected(match);
      } else {
        // Unknown id — fall back gracefully to the collection view and tidy the URL
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

  // Step left/right through the BLOOM collection while the modal is open.
  // dir = +1 → next, -1 → previous; index wraps with modulo so it loops forever.
  // We use replaceState (not pushState) so the back button still returns to /pets
  // rather than walking through every design the user previewed.
  const goPet = (dir) => {
    if (!selected || !designs.length) return;
    const idx = designs.findIndex(d => d.id === selected.id);
    if (idx < 0) return;
    const len = designs.length;
    const nextIdx = ((idx + dir) % len + len) % len;
    const d = designs[nextIdx];
    setSelected(d);
    const slug = slugify(d);
    if (slug) window.history.replaceState({ page: "pets" }, "", `#pets/${slug}`);
  };

  // Position of the currently-open design — passed to the modal for the "3 / 12" counter.
  const selectedIdx = selected ? designs.findIndex(d => d.id === selected.id) : -1;

  // Translations
  const t = {
    he: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "אוסף מובחר. דמויות עם נשמה.",
      subheading2: "12 דיוקנאות בשמן — לכל אחד אופי משלו.",
      scroll: "גלה את האוסף",
      collectionEyebrow: "האוסף",
      collectionCount: "12 דמויות",
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
    },
    en: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "A curated collection. Characters with soul.",
      subheading2: "12 oil portraits, each one with its own personality.",
      scroll: "Browse the collection",
      collectionEyebrow: "THE COLLECTION",
      collectionCount: "12 CHARACTERS",
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
    },
    ru: {
      eyebrow: "BLOOM COLLECTION · PET COUTURE",
      heading: "Bloom.",
      subheading: "Кураторская коллекция. Персонажи с душой.",
      subheading2: "12 масляных портретов, каждый со своим характером.",
      scroll: "Просмотреть коллекцию",
      collectionEyebrow: "КОЛЛЕКЦИЯ",
      collectionCount: "12 ПЕРСОНАЖЕЙ",
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
        <p className="reveal" data-delay="4" style={{ color: "#555", fontSize: isMobile ? 13 : 15, fontFamily: "'Playfair Display',serif", fontStyle: "italic", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.5 }}>
          {t.subheading2}
        </p>
      </section>

      {/* ===== COLLECTION GRID ===== */}
      <section style={{ position: "relative", zIndex: 1, padding: isMobile ? "20px 16px 80px" : "40px 40px 120px", maxWidth: 1400, margin: "0 auto" }}>
        <div className="reveal" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "2px", marginBottom: 8 }}>
              {t.collectionEyebrow}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.5rem" : "2rem", color: COLORS.white, margin: 0 }}>
              {t.collectionCount}
            </h2>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 80, color: COLORS.gray, fontFamily: "'Varela Round',sans-serif" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.accent, borderRadius: "50%", animation: "petsSpin 0.8s linear infinite", marginBottom: 16 }} />
            <div>{t.loading}</div>
          </div>
        )}

        {!loading && designs.length === 0 && (
          <div style={{ textAlign: "center", padding: 80, color: COLORS.gray, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 20 }}>
            {t.empty}
          </div>
        )}

        {!loading && designs.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: isMobile ? 12 : 24,
          }}>
            {designs.map((d, i) => (
              <PetCard
                key={d.id}
                design={d}
                lang={lang}
                index={i}
                name={getDesignName(d)}
                animal={getAnimal(d)}
                tagline={getTagline(d)}
                priceFrom={t.priceFrom}
                onClick={() => openPet(d)}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="reveal" style={{ position: "relative", zIndex: 1, padding: isMobile ? "60px 20px" : "80px 40px", textAlign: "center", borderTop: `1px solid ${COLORS.border}`, maxWidth: 900, margin: "0 auto" }}>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 700, fontSize: isMobile ? "1.8rem" : "2.4rem", color: COLORS.white, margin: "0 0 12px 0" }}>
          {t.ctaTitle}
        </h3>
        <p style={{ color: COLORS.gray, fontSize: isMobile ? 14 : 16, fontFamily: "'Varela Round',sans-serif", marginBottom: 30 }}>
          {t.ctaSub}
        </p>
        <button onClick={() => setPage("order")} style={{
          background: COLORS.accent,
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
        onMouseOver={e => { e.currentTarget.style.background = COLORS.accentHover; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(255,107,53,0.5)"; }}
        onMouseOut={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(255,107,53,0.35)"; }}
        >{t.ctaBtn}</button>
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
          onClose={closePet}
          isMobile={isMobile}
          onOrderBloom={onOrderBloom}
          onPrev={() => goPet(-1)}
          onNext={() => goPet(1)}
          currentIndex={selectedIdx + 1}
          total={designs.length}
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
      [isRTL ? "right" : "left"]: 10,
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
          background: COLORS.accent,
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
function PetCard({ design, lang, index, name, animal, tagline, priceFrom, onClick, isMobile }) {
  const [hovered, setHovered] = useState(false);
  const imgSrc = design.mockup_url || design.design_url;
  const fallbackBg = design.mockup_bg || "#1a1a1a";

  // Editorial corner-cut on hover (desktop only — no hover on touch)
  const cutCard = hovered && !isMobile;
  const clipPath = cutCard
    ? "polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%)"
    : "polygon(0 0, 100% 0, 100% 100%, 100% 100%, 0 100%)";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        background: "transparent",
        border: `1px solid ${hovered ? COLORS.accent : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14,
        overflow: "hidden",
        clipPath,
        transition: "clip-path 0.4s cubic-bezier(.2,.6,.2,1), transform 0.35s cubic-bezier(.2,.6,.2,1), box-shadow 0.35s cubic-bezier(.2,.6,.2,1), border-color 0.35s",
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
          <span style={{ color: COLORS.gray, fontSize: 11, fontFamily: "'Varela Round',sans-serif" }}>{priceFrom}{design.price_sticker}</span>
          <span style={{ color: hovered ? COLORS.accent : COLORS.white, fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 700, transition: "color 0.2s", letterSpacing: "0.3px" }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ============ PET MODAL — character detail ============
function PetModal({ design, lang, name, animal, tagline, t, onClose, isMobile, onOrderBloom, onPrev, onNext, currentIndex, total }) {
  const isRTL = lang === "he";
  const [selectedColor, setSelectedColor] = useState(BLOOM_SHIRT_COLORS[0]);
  const [shirtType, setShirtType] = useState("basic");
  const [shirtSize, setShirtSize] = useState("m");
  const [zoomed, setZoomed] = useState(false);
  const imgSrc = design.mockup_url || design.design_url;
  const fallbackBg = design.mockup_bg || "#1a1a1a";
  // Show navigation arrows only when there are at least 2 designs to flip between.
  const canNavigate = typeof onPrev === "function" && typeof onNext === "function" && total > 1;

  // Touch swipe: 50px threshold. Left-swipe goes to the next design, right
  // goes back — same convention as Instagram regardless of RTL.
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || !canNavigate || zoomed) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) onNext();
    else if (diff < -50) onPrev();
    touchStartX.current = null;
  };

  // Shirt type → OrderPage product. Sizes match the PRODUCTS variant ids.
  const SHIRT_TYPES = [
    { id: "basic",     productId: "tshirt",    label: { he: "בייסיק",   en: "Basic",     ru: "Базовая" } },
    { id: "oversized", productId: "oversized", label: { he: "אוברסייז", en: "Oversized", ru: "Оверсайз" } },
  ];
  const SHIRT_SIZES = ["s", "m", "l", "xl", "xxl"];

  // Live shirt price comes straight from the PRODUCTS variant prices,
  // so it updates whenever the type or size changes.
  const shirtProductId = shirtType === "oversized" ? "oversized" : "tshirt";
  const shirtProductDef = PRODUCTS(LANGS[lang]).find(p => p.id === shirtProductId);
  const shirtVariantDef = shirtProductDef ? shirtProductDef.variants.find(v => v.id === shirtSize) : null;
  const shirtPrice = shirtVariantDef ? shirtVariantDef.price : (design.price_shirt || 0);

  // Add this BLOOM character to the order cart with its design already fixed.
  // Shirt carries the chosen type, size and color; mug/sticker keep defaults.
  const handleOrder = (kind) => {
    if (!design.design_url) return;
    // The polished image the customer is actually looking at in this modal —
    // saved on the order so the order preview matches what they saw.
    const mockupUrl = design.mockup_url || design.design_url;
    if (kind === "shirt") {
      onOrderBloom({
        productId: shirtProductId,
        variantId: shirtSize,
        price: Number(shirtPrice) || 0,
        designUrl: design.design_url,
        mockupUrl,
        characterName: name,
        shirtColor: selectedColor,
      });
      return;
    }
    const map = {
      mug:     { productId: "mug",     price: design.price_mug },
      sticker: { productId: "sticker", price: design.price_sticker },
    };
    const choice = map[kind];
    if (!choice) return;
    onOrderBloom({
      productId: choice.productId,
      price: Number(choice.price) || 0,
      designUrl: design.design_url,
      mockupUrl,
      characterName: name,
      shirtColor: null,
    });
  };

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Keyboard nav inside the modal:
  //   Esc → close zoom first, then close the modal
  //   ← / → → step through BLOOM designs (LTR-friendly; RTL users still get
  //   "right arrow = next" because most carousels worldwide work that way)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (zoomed) { setZoomed(false); return; }
        onClose();
        return;
      }
      if (!canNavigate || zoomed) return;
      if (e.key === "ArrowRight") { e.preventDefault(); onNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); onPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, zoomed, canNavigate, onPrev, onNext]);

  return (
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
          [isRTL ? "left" : "right"]: 16,
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
        onMouseOver={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.borderColor = COLORS.accent; }}
        onMouseOut={e => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; e.currentTarget.style.borderColor = COLORS.border; }}
        aria-label={t.modalClose}
        >×</button>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 0 }}>
          {/* Image */}
          <div
            onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            title={lang === "he" ? "לחץ להגדלה" : lang === "ru" ? "Нажмите, чтобы увеличить" : "Click to zoom"}
            style={{
              position: "relative",
              background: design.mockup_url ? "#1a1a1a" : fallbackBg,
              aspectRatio: isMobile ? "1" : "auto",
              minHeight: isMobile ? "auto" : 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: design.mockup_url ? 0 : "10%",
              cursor: "zoom-in",
              touchAction: "pan-y",
            }}>
            <SmartImage src={imgSrc} alt={name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: design.mockup_url ? "cover" : "contain", width: design.mockup_url ? "100%" : "auto", height: design.mockup_url ? "100%" : "auto" }} />
            <PetBadges design={design} lang={lang} />

            {/* Prev/next chevrons — visible only when there are 2+ designs.
                Larger tap targets on mobile so a finger can hit them comfortably.
                stopPropagation so clicking the arrows does NOT open the zoom overlay. */}
            {canNavigate && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  aria-label={lang === "he" ? "עיצוב קודם" : lang === "ru" ? "Предыдущий дизайн" : "Previous design"}
                  className="bloom-nav-btn"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: isMobile ? 8 : 12,
                    transform: "translateY(-50%)",
                    width: isMobile ? 52 : 44,
                    height: isMobile ? 52 : 44,
                    border: "none",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.55)",
                    color: COLORS.accent,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 4,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    touchAction: "manipulation",
                    transition: "transform 0.18s cubic-bezier(.2,.6,.2,1), background 0.18s, color 0.18s",
                  }}>
                  <svg width={isMobile ? 28 : 22} height={isMobile ? 28 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  aria-label={lang === "he" ? "עיצוב הבא" : lang === "ru" ? "Следующий дизайн" : "Next design"}
                  className="bloom-nav-btn"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: isMobile ? 8 : 12,
                    transform: "translateY(-50%)",
                    width: isMobile ? 52 : 44,
                    height: isMobile ? 52 : 44,
                    border: "none",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.55)",
                    color: COLORS.accent,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 4,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    touchAction: "manipulation",
                    transition: "transform 0.18s cubic-bezier(.2,.6,.2,1), background 0.18s, color 0.18s",
                  }}>
                  <svg width={isMobile ? 28 : 22} height={isMobile ? 28 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* "3 / 12" position counter — sits at the bottom-center of the image,
                    matches the look of the zoom indicator. */}
                <div aria-live="polite" style={{
                  position: "absolute",
                  bottom: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  borderRadius: 20,
                  padding: "5px 14px",
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono','Courier New',monospace",
                  letterSpacing: "0.12em",
                  backdropFilter: "blur(6px)",
                  pointerEvents: "none",
                }}>
                  {currentIndex} / {total}
                </div>
              </>
            )}

            <div aria-hidden="true" style={{ position: "absolute", bottom: 12, [isRTL ? "left" : "right"]: 12, background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: 20, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "'Varela Round',sans-serif", letterSpacing: "0.05em", backdropFilter: "blur(6px)", pointerEvents: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <span>{lang === "he" ? "הגדל" : lang === "ru" ? "Увеличить" : "Zoom"}</span>
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: isMobile ? "28px 24px" : "40px 36px", display: "flex", flexDirection: "column" }}>
            <div style={{ color: COLORS.accent, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 10, letterSpacing: "2px", marginBottom: 16, textTransform: "uppercase" }}>
              BLOOM Collection
            </div>

            <h2 style={{
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

            <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 14 }}>
              {t.availableOn}
            </div>

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
                  <div
                    key={c.id}
                    onClick={() => setSelectedColor(c)}
                    title={c[lang] || c.en}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", background: c.hex, cursor: "pointer",
                      border: `3px solid ${selectedColor.id === c.id ? COLORS.accent : "transparent"}`,
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
                      transition: "transform 0.15s, border-color 0.15s",
                      transform: selectedColor.id === c.id ? "scale(1.18)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Shirt type — Basic / Oversized (applies to the shirt option) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>
                {lang === "he" ? "סוג חולצה" : lang === "ru" ? "Тип футболки" : "Shirt type"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {SHIRT_TYPES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setShirtType(st.id)}
                    style={{
                      flex: 1,
                      background: shirtType === st.id ? COLORS.accent : COLORS.bg,
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

            {/* Shirt size — S / M / L / XL / XXL (applies to the shirt option) */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: COLORS.gray, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>
                {lang === "he" ? "מידה" : lang === "ru" ? "Размер" : "Size"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SHIRT_SIZES.map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setShirtSize(sz)}
                    style={{
                      minWidth: 46,
                      background: shirtSize === sz ? COLORS.accent : COLORS.bg,
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

            {/* Product buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <ProductOption label={t.shirtLabel} price={shirtPrice} onClick={() => handleOrder("shirt")} disabled={!design.design_url} />
              <ProductOption label={t.mugLabel} price={design.price_mug} onClick={() => handleOrder("mug")} disabled={!design.design_url} />
              <ProductOption label={t.stickerLabel} price={design.price_sticker} onClick={() => handleOrder("sticker")} disabled={!design.design_url} />
            </div>
          </div>
        </div>
      </div>

      {zoomed && (
        <div
          onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
          role="dialog"
          aria-label={lang === "he" ? "תמונה מוגדלת" : lang === "ru" ? "Увеличенное изображение" : "Zoomed image"}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0,0,0,0.95)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            cursor: "zoom-out",
            animation: "petZoomFadeIn 0.2s ease-out",
          }}>
          <SmartImage src={imgSrc} alt={name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }} />
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            aria-label={t.modalClose}
            style={{
              position: "absolute",
              top: 20,
              [isRTL ? "left" : "right"]: 20,
              width: 44, height: 44,
              background: "rgba(255,255,255,0.1)",
              border: `1px solid rgba(255,255,255,0.25)`,
              borderRadius: "50%",
              color: "#fff",
              cursor: "pointer",
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes petModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes petModalSlideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes petZoomFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .bloom-nav-btn:hover { background: rgba(0,0,0,0.7) !important; color: #fff !important; transform: translateY(-50%) scale(1.15) !important; box-shadow: 0 0 24px rgba(255,107,53,0.5); }
        .bloom-nav-btn:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; }
        .bloom-nav-btn:active { transform: translateY(-50%) scale(1.05) !important; }
      `}</style>
    </div>
  );
}

// ============ Product option button inside modal ============
function ProductOption({ label, price, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: disabled ? "transparent" : (hovered ? "rgba(255,107,53,0.1)" : COLORS.bg),
        border: `1px solid ${disabled ? COLORS.border : (hovered ? COLORS.accent : COLORS.border)}`,
        borderRadius: 10,
        padding: "16px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "all 0.25s",
        opacity: disabled ? 0.4 : 1,
        width: "100%",
        textAlign: "inherit",
      }}>
      <span style={{ color: hovered && !disabled ? COLORS.accent : COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 15, fontWeight: 600, transition: "color 0.2s" }}>{label}</span>
      <span style={{ color: COLORS.gray, fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 18, fontWeight: 700 }}>₪{price}</span>
    </button>
  );
}

function MaintenancePage({ lang, setLang, setPage }) {
  const messages = {
    he: { title: "האתר בתחזוקה", sub: "אנחנו עובדים על שדרוגים מרגשים", back: "נחזור בקרוב!", staff: "כניסת צוות" },
    en: { title: "Under Maintenance", sub: "We are working on exciting upgrades", back: "Back soon!", staff: "Staff login" },
    ru: { title: "Сайт на обслуживании", sub: "Мы работаем над улучшениями", back: "Скоро вернёмся!", staff: "Вход для персонала" },
  };
  const m = messages[lang] || messages.he;
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, zIndex: 10, direction: lang === "he" ? "rtl" : "ltr" }}>
      <div style={{ position: "absolute", top: 20, right: 20, display: "flex", gap: 8 }}>
        {["he", "en", "ru"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? "#FF6B35" : "transparent", border: `1px solid ${lang === l ? "#FF6B35" : "#333"}`, color: lang === l ? "#fff" : "#999", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif" }}>
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
        <p style={{ color: "#FF6B35", fontSize: 16, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", marginBottom: 36 }}>{m.back}</p>
        <a href="https://www.instagram.com/sfalimshop/" target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(45deg, #F58529, #DD2A7B, #8134AF, #515BD4)", color: "#fff", padding: "12px 24px", borderRadius: 10, textDecoration: "none", fontFamily: "'Varela Round',sans-serif", fontWeight: 600, fontSize: 14 }}>
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
      <div style={{ position: "absolute", bottom: 56, fontSize: 12, color: "#666", fontFamily: "'Varela Round',sans-serif", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "center", padding: "0 16px" }}>
        <a href="/privacy" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "פרטיות" : lang === "ru" ? "Конфиденциальность" : "Privacy Policy"}
        </a>
        <span style={{ color: "#444" }}>·</span>
        <a href="/terms" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "תקנון" : lang === "ru" ? "Условия" : "Terms of Service"}
        </a>
        <span style={{ color: "#444" }}>·</span>
        <a href="/accessibility" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "נגישות" : lang === "ru" ? "Доступность" : "Accessibility"}
        </a>
        <span style={{ color: "#444" }}>·</span>
        <a href="mailto:hello@sfalimshop.com" style={{ color: "#888", textDecoration: "none" }}>
          {lang === "he" ? "צור קשר" : lang === "ru" ? "Контакты" : "Contact"}
        </a>
      </div>
      <div style={{ position: "absolute", bottom: 20, fontSize: 11, color: "#555", fontFamily: "'Varela Round',sans-serif" }}>
        <a href="?staff=1" style={{ color: "#555", textDecoration: "none" }}>· {m.staff} ·</a>
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
    return (window.location.hash.split("?")[0].replace("#", "") || "").split("/")[1] || "refund";
  })();
  const [activeSection, setActiveSection] = useState(sectionFromURL);
  const content = POLICIES[lang] || POLICIES.he;
  const isRTL = lang === "he";

  useEffect(() => {
    const onHashChange = () => {
      const s = (window.location.hash.replace("#", "") || "").split("/")[1] || "refund";
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
      <h1 style={{ color: "#fff", fontFamily: "'Playfair Display',serif", fontSize: 42, marginBottom: 8 }}>
        {lang === "he" ? "מדיניות ותקנון" : lang === "ru" ? "Политика и условия" : "Policies & Terms"}
      </h1>
      <p style={{ color: "#999", fontSize: 15, marginBottom: 32, fontFamily: "'Varela Round',sans-serif" }}>
        {BUSINESS_INFO.name[lang]}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
        {POLICY_SECTIONS.map(s => (
          <button key={s.id} onClick={() => goSection(s.id)} style={{ background: activeSection === s.id ? "#FF6B35" : "#1a1a1a", color: activeSection === s.id ? "#fff" : "#999", border: `1px solid ${activeSection === s.id ? "#FF6B35" : "#333"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 600 }}>
            {s.title[lang]}
          </button>
        ))}
      </div>

      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 16, padding: "32px 28px" }}>
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
        <div><a href={`mailto:${BUSINESS_INFO.email}`} style={{ color: "#ccc", textDecoration: "none" }}>{BUSINESS_INFO.email}</a> · <a href={`tel:${BUSINESS_INFO.phone}`} style={{ color: "#ccc", textDecoration: "none" }}>{BUSINESS_INFO.phone}</a></div>
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
  return (
    <footer style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a", padding: "48px 24px 24px", marginTop: 60, direction: isRTL ? "rtl" : "ltr", position: "relative", zIndex: 5 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 40 }}>
        <div>
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
              <a href={`tel:${BUSINESS_INFO.phone}`} className="footer-contact-link" style={{ color: "#888" }}>{BUSINESS_INFO.phone}</a>
            </div>
            <div>
              <a href={`mailto:${BUSINESS_INFO.email}`} className="footer-contact-link" style={{ color: "#888" }}>{BUSINESS_INFO.email}</a>
            </div>
            <div style={{ marginTop: 12, color: "#b0b0b0", fontSize: 11, letterSpacing: "0.03em" }}>{lang === "he" ? "ח.פ." : lang === "ru" ? "Бизнес-ID" : "Business ID"} {BUSINESS_INFO.vatId} {lang === "he" ? "(עוסק פטור)" : lang === "ru" ? "(освобождённый предприниматель)" : "(Exempt Dealer)"}</div>
          </div>
        </div>
        <div>
          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Varela Round',sans-serif" }}>
            {lang === "he" ? "מידע משפטי" : lang === "ru" ? "Юр. информация" : "Legal"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {POLICY_SECTIONS.map(s => (
              <button key={s.id} onClick={() => goPolicy(s.id)} className="footer-link" style={{ textAlign: isRTL ? "right" : "left" }}>
                {s.title[lang]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Varela Round',sans-serif" }}>
            {lang === "he" ? "עקבו אחרינו" : lang === "ru" ? "Соцсети" : "Follow Us"}
          </div>
          <a href="https://www.instagram.com/sfalimshop/" target="_blank" rel="noopener" className="footer-contact-link" style={{ display: "inline-block", color: "#888", fontFamily: "'Varela Round',sans-serif", fontSize: 14, fontWeight: 500, letterSpacing: "0.3px" }}>
            Instagram <span style={{ color: "#555" }}>· @sfalimshop</span>
          </a>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "40px auto 0", paddingTop: 22, borderTop: "1px solid #1a1a1a", color: "#444", fontSize: 11, fontFamily: "'Varela Round',sans-serif", textAlign: "center", letterSpacing: "0.05em" }}>
        © {new Date().getFullYear()} {BUSINESS_INFO.name[lang]} · {lang === "he" ? "כל הזכויות שמורות" : lang === "ru" ? "Все права защищены" : "All rights reserved"}
      </div>
    </footer>
  );
}
